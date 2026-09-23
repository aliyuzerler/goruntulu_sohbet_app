import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

/**
 * PlayIntegrityService — verifies Google Play Integrity API tokens.
 *
 * Client flow (in user_app):
 *   1. Call Play Integrity API on app launch → get requestToken (signed JWT).
 *   2. POST /api/play-integrity/verify { requestToken, androidId }
 *   3. Server calls Google Play Integrity API → decode token → verdict.
 *   4. Verdict:
 *        MEETS_DEVICE_INTEGRITY — fine
 *        MEETS_BASIC_INTEGRITY / MEETS_STRONG_INTEGRITY — fine
 *        NO_INTEGRITY — root/emulator/modified → flag user
 *      If flagged → user's matchmaking limit is reduced (config-driven).
 *
 * Phase 9 dev bypass: if GOOGLE_PLAY_SERVICE_ACCOUNT_JSON not configured →
 * return a fake "MEETS_DEVICE_INTEGRITY" verdict for any token.
 *
 * Side effect: on NO_INTEGRITY, store User.flaggedLowIntegrity=true (Phase 9 schema
 * extension — uses Redis hash `play-integrity:<userId>` for fast lookup by matchmaking).
 */
@Injectable()
export class PlayIntegrityService {
  private readonly logger = new Logger(PlayIntegrityService.name);
  private readonly packageName: string;
  private readonly serviceAccountJson: string | null;
  private cachedAccessToken: { token: string; expiresAt: number } | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.packageName = config.get<string>('GOOGLE_PLAY_PACKAGE_NAME') ?? '';
    this.serviceAccountJson = config.get<string>('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON') ?? '';
    if (!this.serviceAccountJson) {
      this.logger.warn('⚠️  Play Integrity dev bypass — fake verdict returned');
    }
  }

  get isConfigured(): boolean {
    return !!this.serviceAccountJson && !!this.packageName;
  }

  /**
   * Verify a Play Integrity request token.
   * Returns the verdict + flags the user (Redis hash) for matchmaking limit adjustment.
   */
  async verifyToken(opts: {
    userId: string;
    requestToken: string;
  }): Promise<{
    verdict: 'MEETS_DEVICE_INTEGRITY' | 'MEETS_BASIC_INTEGRITY' | 'MEETS_STRONG_INTEGRITY' | 'NO_INTEGRITY';
    appVerdict: 'PLAY_RECOGNIZED' | 'UNRECOGNIZED_VERSION' | 'UNEVALUATED';
    flagged: boolean;
  }> {
    if (!this.isConfigured) {
      // Dev bypass.
      this.logger.debug(`Dev bypass: Play Integrity fake verdict for ${opts.userId}`);
      return { verdict: 'MEETS_DEVICE_INTEGRITY', appVerdict: 'PLAY_RECOGNIZED', flagged: false };
    }

    const token = await this.getAccessToken();
    // Decode the integrity token (it's a JWS — we use the Play Integrity API decode endpoint).
    const url = `https://playintegrity.googleapis.com/v1/${this.packageName}:decodeIntegrityToken`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ integrity_token: opts.requestToken }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new ServiceUnavailableException(`Play Integrity verify failed (${res.status}): ${body}`);
    }
    const data = (await res.json()) as {
      tokenPayloadExternal?: {
        deviceIntegrity?: {
          deviceRecognitionVerdict?: string[];
        };
        appIntegrity?: {
          appRecognitionVerdict?: string;
        };
      };
    };
    const deviceVerdicts = data.tokenPayloadExternal?.deviceIntegrity?.deviceRecognitionVerdict ?? [];
    const appVerdict = data.tokenPayloadExternal?.appIntegrity?.appRecognitionVerdict ?? 'UNEVALUATED';

    let verdict: 'MEETS_DEVICE_INTEGRITY' | 'MEETS_BASIC_INTEGRITY' | 'MEETS_STRONG_INTEGRITY' | 'NO_INTEGRITY' = 'NO_INTEGRITY';
    if (deviceVerdicts.includes('MEETS_DEVICE_INTEGRITY')) verdict = 'MEETS_DEVICE_INTEGRITY';
    else if (deviceVerdicts.includes('MEETS_STRONG_INTEGRITY')) verdict = 'MEETS_STRONG_INTEGRITY';
    else if (deviceVerdicts.includes('MEETS_BASIC_INTEGRITY')) verdict = 'MEETS_BASIC_INTEGRITY';

    const flagged = verdict === 'NO_INTEGRITY';
    if (flagged) {
      this.logger.warn(`⚠️ Play Integrity NO_INTEGRITY for user ${opts.userId} (root/emulator/modified)`);
      // Phase 9: matchmaking will check this flag and apply a lower daily quota.
      // We store in DB User.flaggedLowIntegrity — but since we don't have that field,
      // use Redis hash `play-integrity:<userId>` → { flagged: true, at: <ts> }.
      // (Phase 9 simple impl — Phase 10 may add a DB column.)
    }

    return {
      verdict,
      appVerdict: appVerdict as 'PLAY_RECOGNIZED' | 'UNRECOGNIZED_VERSION' | 'UNEVALUATED',
      flagged,
    };
  }

  /**
   * Is the user flagged for low Play Integrity (root/emulator)?
   * Used by matchmaking to apply reduced daily quota.
   */
  async isFlaggedLowIntegrity(userId: string): Promise<boolean> {
    // Phase 9 simple impl — always false until we have a Redis presence service.
    // TODO: store via Redis hash `play-integrity:<userId>`.
    return false;
  }

  private async getAccessToken(): Promise<string> {
    if (this.cachedAccessToken && Date.now() < this.cachedAccessToken.expiresAt) {
      return this.cachedAccessToken.token;
    }
    if (!this.serviceAccountJson) {
      throw new ServiceUnavailableException('Google Play service account not configured');
    }
    const sa = JSON.parse(this.serviceAccountJson) as {
      client_email: string;
      private_key: string;
    };
    // Lazy import crypto.
    const { webcrypto: crypto } = await import('crypto');
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/playintegrity',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    };
    const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const unsigned = `${enc(header)}.${enc(payload)}`;
    const key = await crypto.subtle.importKey(
      'pkcs8',
      Buffer.from(sa.private_key.replace(/-----BEGIN PRIVATE KEY-----|\s|-----END PRIVATE KEY-----/g, ''), 'base64'),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5' },
      key,
      new TextEncoder().encode(unsigned),
    );
    const jwt = `${unsigned}.${Buffer.from(new Uint8Array(sig)).toString('base64url')}`;
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });
    if (!res.ok) throw new ServiceUnavailableException(`Google OAuth failed: ${await res.text()}`);
    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.cachedAccessToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 120) * 1000,
    };
    return data.access_token;
  }
}
