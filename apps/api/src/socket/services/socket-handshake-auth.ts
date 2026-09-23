import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

// socket.io's Handshake type isn't re-exported cleanly; use a local interface.
interface SocketHandshake {
  auth?: { token?: string };
  headers: { authorization?: string };
  address?: string;
}

/**
 * SocketHandshakeAuth — verifies the JWT access token in the socket.io
 * handshake. Used by the gateway to refuse unauthenticated connections at
 * the transport layer (no need to validate per-event).
 *
 * Handshake auth: client passes `auth: { token: '<jwt>' }` in the
 * socket.io client options. We verify it server-side here.
 *
 * Phase 7 will add: refresh-then-resume (if access token expired but
 * refresh is valid, allow connect and emit a `TOKEN_EXPIRED` event so
 * the client can refresh without dropping the connection).
 */
@Injectable()
export class SocketHandshakeAuth {
  private readonly logger = new Logger(SocketHandshakeAuth.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Verify the JWT in the handshake. Returns the decoded payload or throws.
   * Used as the `verifyClient` callback for socket.io.
   */
  async verify(handshake: SocketHandshake): Promise<{
    id: string;
    role: string;
    deviceId?: string;
    kind?: string;
  }> {
    const token = this.extractToken(handshake);
    if (!token) {
      this.logger.debug(`Handshake missing token from ${handshake.address}`);
      throw new UnauthorizedException('Token missing');
    }

    try {
      const payload = await this.jwt.verifyAsync(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET')!,
      });
      if (!payload || !payload.sub) {
        throw new UnauthorizedException('Token payload missing sub');
      }
      return {
        id: payload.sub,
        role: payload.role,
        deviceId: payload.deviceId,
        kind: payload.kind ?? 'user',
      };
    } catch (e) {
      this.logger.debug(`Handshake verify failed: ${(e as Error).message}`);
      throw new UnauthorizedException('Token invalid or expired');
    }
  }

  /** Extract JWT from handshake — supports both `auth.token` (preferred) and `headers.authorization` (fallback). */
  private extractToken(handshake: SocketHandshake): string | null {
    // Preferred: socket.io client `auth: { token: '...' }` pattern.
    const auth = handshake.auth;
    if (auth?.token && typeof auth.token === 'string') {
      return auth.token;
    }
    // Fallback: Authorization: Bearer <token>
    const h = handshake.headers.authorization;
    if (typeof h === 'string' && h.startsWith('Bearer ')) {
      return h.slice('Bearer '.length);
    }
    return null;
  }
}
