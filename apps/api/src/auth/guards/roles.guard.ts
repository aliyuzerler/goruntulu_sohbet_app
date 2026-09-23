import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * RolesGuard — server-enforced role check. Combined with @Roles(...) decorator.
 * The role is read from `req.user.role` which comes from the JWT (signed,
 * tamper-evident). NEVER accept role from the client request body.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles(UserRole.ADMIN)
 *   @Get('/admin/users')
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.get<string[]>('roles', ctx.getHandler());
    if (!required || required.length === 0) {
      return true;
    }
    const req = ctx.switchToHttp().getRequest<{ user?: { role?: string } }>();
    const role = req.user?.role;
    if (!role || !required.includes(role)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
