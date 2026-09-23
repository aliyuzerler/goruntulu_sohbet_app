import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RtcTokenBuilder, RtcRole } from 'agora-access-token';

/**
 * AgoraService — server-side Agora RTC token generation.
 *
 * Why server-side? The App Certificate must NEVER ship to the client. The
 * client requests a short-lived token from this service; the server signs
 * it using the App Certificate and returns a token valid for 1 hour.
 *
 * Token TTL: 3600 seconds (1 hour). Plenty for a typical video call.
 * Phase 4 also issues a fresh token on rejoin (reconnect after network drop).
 *
 * Channel naming: `call_<callId>` — server-generated, unique per call.
 * UID: derived from the user ID hash so it's stable across rejoins (Agora
 * uses the UID to identify the stream — must match on both sides of a rejoin).
 */
@Injectable()
export class AgoraService {
  private readonly logger = new Logger(AgoraService.name);
  private readonly appId: string;
  private readonly appCertificate: string;
  private readonly tokenTtlSec: number;

  constructor(config: ConfigService) {
    this.appId = config.get<string>('AGORA_APP_ID') ?? '';
    this.appCertificate = config.get<string>('AGORA_APP_CERTIFICATE') ?? '';
    this.tokenTtlSec = 3600; // 1 hour
    if (!this.appId || !this.appCertificate) {
      this.logger.warn(
        '⚠️  AGORA_APP_ID or AGORA_APP_CERTIFICATE not set — token generation will fail. ' +
          'Set these in .env for real Agora. Dev/CI can use stub tokens (handled by client bypass).',
      );
    }
  }

  /** True if real Agora is configured. False in dev/CI (client uses bypass). */
  get isConfigured(): boolean {
    return !!this.appId && !!this.appCertificate;
  }

  /**
   * Generate an RTC token for a (channel, uid) pair.
   *
   * The client passes this token to RtcEngine.joinChannel().
   * Phase 4 also passes this token back via the match:found envelope.
   */
  generateToken(opts: { channelName: string; uid: number; role?: 'publisher' | 'subscriber' }): string {
    if (!this.isConfigured) {
      // Dev bypass — return a fake token so the client can try to connect.
      // Real Agora will reject this, but the client can run in mock mode.
      return `dev_token_${opts.channelName}_${opts.uid}_${Date.now()}`;
    }
    const role = opts.role === 'subscriber' ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;
    const expiration = Math.floor(Date.now() / 1000) + this.tokenTtlSec;
    return RtcTokenBuilder.buildTokenWithUid(
      this.appId,
      this.appCertificate,
      opts.channelName,
      opts.uid,
      role,
      expiration,
    );
  }

  /**
   * Convert a user UUID to a 32-bit Agora UID.
   * Agora UIDs are uint32; we hash the user ID string to get a stable,
   * collision-resistant integer. Same user → same UID across rejoins,
   * which lets Agora's caching kick in.
   */
  userUuidToUid(userUuid: string): number {
    // Hash the user UUID's hex chars down to 32 bits. Spread the bits so
    // different UUIDs end up in different UID ranges (better load balancing
    // on Agora side).
    let h = 0x811c9dc5; // FNV-1a 32-bit offset basis
    for (let i = 0; i < userUuid.length; i++) {
      h ^= userUuid.charCodeAt(i);
      // FNV-1a 32-bit prime
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0; // force unsigned 32-bit
  }

  /** Channel name for a call — server-generated, derived from callId. */
  channelForCall(callId: string): string {
    if (!/^[0-9a-fA-F-]{36}$/.test(callId)) {
      throw new BadRequestException(`Invalid callId format: ${callId}`);
    }
    return `call_${callId.replace(/-/g, '')}`;
  }
}
