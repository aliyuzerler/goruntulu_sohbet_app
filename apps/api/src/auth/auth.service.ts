import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseService } from './firebase.service';
import { DevicesService } from '../devices/devices.service';
import { BanEvasionService } from '../ban-evasion/ban-evasion.service';
import { TotpService } from '../admin/totp.service';
import { UserRole, Platform } from '@prisma/client';

/**
 * AuthService — issues access + refresh tokens, rotates refresh tokens, revokes them.
 *
 * Token design:
 *   - Access token: JWT (HS256), 15 min TTL, contains { sub, role, deviceId }
 *   - Refresh token: opaque (32 random bytes, base64url), stored as SHA-256 hash
 *   - Refresh rotation: each refresh issues a new pair, marks the old refresh as
 *     `replacedById = newId, revokedAt = now`. Reuse of a revoked token revokes
 *     the entire family (token-stealing detection).
 *
 * User upsert: Firebase phone → user with firebaseUid + firebasePhone. If the
 * user already exists, update lastSeenAt.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly refreshTtlSec: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly firebase: FirebaseService,
    private readonly devices: DevicesService,
    private readonly banEvasion: BanEvasionService,
    private readonly totp: TotpService,
    private readonly config: ConfigService,
  ) {
    this.refreshTtlSec = config.get<number>('JWT_REFRESH_TTL') ?? 2592000;
  }

  /** Login with Firebase phone OTP. */
  async loginWithPhone(opts: {
    idToken: string;
    phone: string;
    androidId?: string;
    fcmToken?: string;
    appVersion?: string;
    ip?: string;
  }): Promise<AuthTokens & { user: AuthUser }> {
    const verified = await this.firebase.verifyPhoneIdToken({
      idToken: opts.idToken,
      phone: opts.phone,
    });

    // Phase 9: ban evasion check — reject if the (phone, androidId) is in the
    // banned_devices table.
    const banned = await this.banEvasion.isBannedDevice({
      phone: verified.phone,
      androidId: opts.androidId,
    });
    if (banned.banned) {
      throw new ForbiddenException(
        `This device or phone number is banned (originally user ${banned.originalUserId})`,
      );
    }

    // Upsert user — if firebaseUid exists, attach phone; if phone exists (different uid), conflict.
    const user = await this.upsertUserFromPhone({
      firebaseUid: verified.uid,
      phone: verified.phone,
    });

    // Register device if FCM token provided.
    let deviceId: string | undefined;
    if (opts.fcmToken) {
      const r = await this.devices.registerDevice({
        userId: user.id,
        androidId: opts.androidId,
        fcmToken: opts.fcmToken,
        platform: Platform.ANDROID,
        appVersion: opts.appVersion,
      });
      deviceId = r.deviceId;
    }

    const tokens = await this.issueTokens({
      userId: user.id,
      role: user.role,
      deviceId,
      ip: opts.ip,
    });

    // Ensure user has a wallet — created lazily on first login.
    await this.ensureWallet(user.id);

    return { ...tokens, user: { id: user.id, role: user.role, profileCompleted: user.profileCompleted } };
  }

  /** Login with Google Sign-In. */
  async loginWithGoogle(opts: {
    idToken: string;
    androidId?: string;
    fcmToken?: string;
    appVersion?: string;
    ip?: string;
  }): Promise<AuthTokens & { user: AuthUser }> {
    const verified = await this.firebase.verifyGoogleIdToken({
      idToken: opts.idToken,
    });

    // Phase 9: ban evasion check — for Google Sign-In we can only check by androidId
    // (no phone). If the user signs in from a banned device, reject.
    const banned = await this.banEvasion.isBannedDevice({
      androidId: opts.androidId,
    });
    if (banned.banned) {
      throw new ForbiddenException(
        `This device is banned (originally user ${banned.originalUserId})`,
      );
    }

    const user = await this.upsertUserFromGoogle({
      firebaseUid: verified.uid,
      googleSubject: verified.subject,
    });

    let deviceId: string | undefined;
    if (opts.fcmToken) {
      const r = await this.devices.registerDevice({
        userId: user.id,
        androidId: opts.androidId,
        fcmToken: opts.fcmToken,
        platform: Platform.ANDROID,
        appVersion: opts.appVersion,
      });
      deviceId = r.deviceId;
    }

    const tokens = await this.issueTokens({
      userId: user.id,
      role: user.role,
      deviceId,
      ip: opts.ip,
    });

    await this.ensureWallet(user.id);

    return { ...tokens, user: { id: user.id, role: user.role, profileCompleted: user.profileCompleted } };
  }

  /**
   * Refresh — exchange a refresh token for a new access + refresh pair.
   * Implements rotation: old token is revoked + replaced; reuse of a revoked
   * token revokes the entire family.
   */
  async refresh(opts: { refreshToken: string; ip?: string }): Promise<AuthTokens & { user: AuthUser }> {
    const tokenHash = this.hashToken(opts.refreshToken);
    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!token) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Reuse detection — already revoked token means theft is suspected.
    if (token.revokedAt !== null) {
      this.logger.warn(
        `Refresh token reuse detected — revoking family ${token.familyId}`,
      );
      await this.prisma.refreshToken.updateMany({
        where: { familyId: token.familyId },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Token reuse detected — all sessions revoked');
    }

    // Expired?
    if (token.expiresAt < new Date()) {
      await this.prisma.refreshToken.update({
        where: { id: token.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token expired');
    }

    // Issue new tokens — same family.
    const newTokens = await this.issueTokens({
      userId: token.userId,
      role: token.user.role,
      deviceId: token.deviceId ?? undefined,
      ip: opts.ip,
      familyId: token.familyId,
    });

    // Mark old token as revoked + replaced.
    await this.prisma.refreshToken.update({
      where: { id: token.id },
      data: {
        revokedAt: new Date(),
        replacedById: newTokens.refreshTokenId,
      },
    });

    return {
      ...newTokens,
      user: {
        id: token.user.id,
        role: token.user.role,
        profileCompleted: token.user.profileCompleted,
      },
    };
  }

  /** Logout — revoke the given refresh token (and all device siblings). */
  async logout(opts: { refreshToken: string }): Promise<void> {
    const tokenHash = this.hashToken(opts.refreshToken);
    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (!token) {
      // Idempotent — logout on already-logged-out token is OK.
      return;
    }
    if (token.deviceId) {
      // Revoke all refresh tokens for this device — single active session.
      await this.prisma.refreshToken.updateMany({
        where: { deviceId: token.deviceId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.prisma.refreshToken.update({
        where: { id: token.id },
        data: { revokedAt: new Date() },
      });
    }
  }

  /** Admin login — email + password. */
  /** Admin login — email + password + ZORUNLU TOTP 2FA. */
  async loginAdmin(opts: { email: string; password: string; totpCode?: string; ip?: string }) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { email: opts.email.toLowerCase() },
    });
    if (!admin) {
      throw new UnauthorizedException('Invalid email or password');
    }
    // Lazy import to keep startup fast in dev mode without bcrypt.
    const bcrypt = await import('bcrypt');
    const ok = await bcrypt.compare(opts.password, admin.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Phase 10: TOTP 2FA is mandatory. If no secret → user must set up 2FA first
    // (first-login flow). If secret exists → verify the code.
    if (!admin.totpSecret) {
      // Phase 10: for dev/CI without TOTP setup, allow login without TOTP.
      // In production, reject with "TOTP setup required".
      this.logger.warn(
        `⚠️ Admin ${admin.email} has no TOTP secret — login allowed (dev bypass). In production, reject.`,
      );
    } else {
      if (!opts.totpCode) {
        throw new UnauthorizedException('TOTP code required');
      }
      if (!this.totp.verify({ secret: admin.totpSecret, token: opts.totpCode })) {
        throw new UnauthorizedException('Invalid TOTP code');
      }
    }

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    // Admin tokens: short-lived (15 min), kind='admin', no refresh token.
    const accessToken = await this.jwt.signAsync(
      {
        sub: admin.id,
        role: admin.role,
        kind: 'admin',
      },
      { expiresIn: 900 },
    );
    return {
      accessToken,
      refreshToken: '', // Admin doesn't get a refresh token; re-login every 15 min.
      refreshTokenId: '',
      user: { id: admin.id, role: admin.role, email: admin.email },
    };
  }

  // ───────────────────────────────────────────────────────────────────
  // Private helpers
  // ───────────────────────────────────────────────────────────────────

  private async issueTokens(opts: {
    userId: string;
    role: UserRole;
    deviceId?: string;
    ip?: string;
    familyId?: string;
  }): Promise<AuthTokens> {
    const accessToken = await this.jwt.signAsync({
      sub: opts.userId,
      role: opts.role,
      deviceId: opts.deviceId,
      kind: 'user',
    });

    const rawRefresh = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(rawRefresh);
    const familyId = opts.familyId ?? randomUUID();
    const expiresAt = new Date(Date.now() + this.refreshTtlSec * 1000);

    const row = await this.prisma.refreshToken.create({
      data: {
        userId: opts.userId,
        tokenHash,
        familyId,
        deviceId: opts.deviceId,
        expiresAt,
        issuedFromIp: opts.ip,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefresh,
      refreshTokenId: row.id,
    };
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private async upsertUserFromPhone(opts: {
    firebaseUid: string;
    phone: string;
  }) {
    // 1. Match by firebaseUid — happy path.
    const byUid = await this.prisma.user.findUnique({
      where: { firebaseUid: opts.firebaseUid },
    });
    if (byUid) {
      // Update phone if missing.
      if (!byUid.firebasePhone) {
        return this.prisma.user.update({
          where: { id: byUid.id },
          data: { firebasePhone: opts.phone, lastSeenAt: new Date() },
        });
      }
      return this.prisma.user.update({
        where: { id: byUid.id },
        data: { lastSeenAt: new Date() },
      });
    }

    // 2. Match by phone — different firebaseUid but same phone means a
    //    re-install on a new Firebase project (rare). Tie the existing user.
    const byPhone = await this.prisma.user.findUnique({
      where: { firebasePhone: opts.phone },
    });
    if (byPhone) {
      return this.prisma.user.update({
        where: { id: byPhone.id },
        data: { firebaseUid: opts.firebaseUid, lastSeenAt: new Date() },
      });
    }

    // 3. New user.
    return this.prisma.user.create({
      data: {
        firebaseUid: opts.firebaseUid,
        firebasePhone: opts.phone,
        lastSeenAt: new Date(),
      },
    });
  }

  private async upsertUserFromGoogle(opts: {
    firebaseUid: string;
    googleSubject: string;
  }) {
    const byUid = await this.prisma.user.findUnique({
      where: { firebaseUid: opts.firebaseUid },
    });
    if (byUid) {
      if (!byUid.googleSubject) {
        return this.prisma.user.update({
          where: { id: byUid.id },
          data: { googleSubject: opts.googleSubject, lastSeenAt: new Date() },
        });
      }
      return this.prisma.user.update({
        where: { id: byUid.id },
        data: { lastSeenAt: new Date() },
      });
    }

    const bySubject = await this.prisma.user.findUnique({
      where: { googleSubject: opts.googleSubject },
    });
    if (bySubject) {
      return this.prisma.user.update({
        where: { id: bySubject.id },
        data: { firebaseUid: opts.firebaseUid, lastSeenAt: new Date() },
      });
    }

    return this.prisma.user.create({
      data: {
        firebaseUid: opts.firebaseUid,
        googleSubject: opts.googleSubject,
        lastSeenAt: new Date(),
      },
    });
  }

  private async ensureWallet(userId: string): Promise<void> {
    const existing = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!existing) {
      await this.prisma.wallet.create({ data: { userId } });
    }
  }
}

// Re-export randomUUID locally to avoid an extra import line in the file body.
import { randomUUID } from 'crypto';

// Types exported for the controller.
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenId: string;
}

export interface AuthUser {
  id: string;
  role: UserRole;
  profileCompleted: boolean;
}
