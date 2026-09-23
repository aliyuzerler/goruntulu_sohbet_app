import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JwtAuthGuard — default auth guard. Activates the 'jwt' passport strategy.
 * Throws 401 if no token / invalid token / expired token.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
