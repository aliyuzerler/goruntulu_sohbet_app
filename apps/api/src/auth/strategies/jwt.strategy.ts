import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

/**
 * JwtStrategy — extracts the JWT from the Authorization: Bearer header,
 * verifies the HS256 signature against JWT_ACCESS_SECRET, and exposes
 * `req.user = { id: sub, role, deviceId }`.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET')!,
    });
  }

  /**
   * Passport calls this with the decoded JWT payload. The return value
   * becomes `req.user`. We deliberately only expose the minimal fields
   * needed by guards + controllers — never the raw payload.
   */
  async validate(payload: {
    sub: string;
    role: string;
    deviceId?: string;
    kind?: string;
  }) {
    return {
      id: payload.sub,
      role: payload.role,
      deviceId: payload.deviceId,
      kind: payload.kind ?? 'user',
    };
  }
}
