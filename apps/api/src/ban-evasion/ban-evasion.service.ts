import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { createHash } from 'crypto';

/**
 * BanEvasionService — prevents banned users from creating new accounts.
 *
 * Phase 9 flow:
 *   1. When a user is banned (StrikeService.applyStrike → User.status=BANNED),
 *      call recordBannedUser({ userId, phone, androidId }).
 *      → Stores BannedDevice row with phoneHash + androidId.
 *   2. On new signup (AuthService.loginWithPhone / loginWithGoogle), call
 *      isBannedDevice({ phone, androidId }) BEFORE creating a new User row.
 *      → Returns true if a BannedDevice row exists with matching phoneHash OR androidId.
 *      → AuthService rejects the signup with FORBIDDEN code.
 *
 * Config:
 *   BAN_EVASION_ENABLED=true (default) — gate the check.
 *   If false, signup doesn't check — useful for dev/staging.
 *
 * Privacy: we never store the raw phone in BannedDevice. Only the SHA-256 hash.
 * The hash is non-reversible (no salt — the phone is already a normalized E.164 string).
 */
@Injectable()
export class BanEvasionService {
  private readonly logger = new Logger(BanEvasionService.name);
  private readonly enabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.enabled = config.get<boolean>('BAN_EVASION_ENABLED') ?? true;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** Hash an E.164 phone number for storage. SHA-256 (no salt — phone is normalized). */
  hashPhone(phone: string): string {
    return createHash('sha256').update(phone).digest('hex');
  }

  /**
   * Check if a new signup would be from a banned device/phone.
   * Returns true if either phoneHash OR androidId matches a BannedDevice row.
   */
  async isBannedDevice(opts: {
    phone?: string;
    androidId?: string;
  }): Promise<{ banned: boolean; originalUserId?: string }> {
    if (!this.enabled) return { banned: false };
    const phoneHash = opts.phone ? this.hashPhone(opts.phone) : null;
    if (!phoneHash && !opts.androidId) return { banned: false };

    const row = await this.prisma.bannedDevice.findFirst({
      where: {
        OR: [
          ...(phoneHash ? [{ phoneHash }] : []),
          ...(opts.androidId ? [{ androidId: opts.androidId }] : []),
        ],
      },
      select: { originalUserId: true },
    });
    if (row) {
      this.logger.warn(
        `🚫 Ban evasion attempt — phoneHash=${phoneHash?.slice(0, 12)}… androidId=${opts.androidId}`,
      );
      return { banned: true, originalUserId: row.originalUserId };
    }
    return { banned: false };
  }

  /**
   * Record a banned user — called by StrikeService when level reaches ban level.
   * Idempotent — if a BannedDevice row already exists for this (phoneHash, androidId),
   * do nothing.
   */
  async recordBannedUser(opts: {
    userId: string;
    phone?: string;
    androidId?: string;
  }): Promise<void> {
    if (!this.enabled) return;
    const phoneHash = opts.phone ? this.hashPhone(opts.phone) : '';
    if (!phoneHash && !opts.androidId) return;

    try {
      await this.prisma.bannedDevice.upsert({
        where: {
          phoneHash_androidId: {
            phoneHash,
            androidId: opts.androidId ?? null,
          } as never,
        },
        create: {
          phoneHash,
          androidId: opts.androidId ?? null,
          originalUserId: opts.userId,
        },
        update: {},
      });
      this.logger.log(
        `✓ Recorded banned device for user ${opts.userId} (phoneHash=${phoneHash?.slice(0, 12)}… androidId=${opts.androidId})`,
      );
    } catch (e) {
      // Idempotency — P2002 means the row already exists.
      this.logger.debug(`BannedDevice already exists: ${(e as Error).message}`);
    }
  }
}
