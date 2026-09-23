import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * @CurrentUser() — extracts the authenticated user from req.user.
 * Set by JwtAuthGuard after JWT verification.
 *
 *   @Get('me')
 *   @UseGuards(JwtAuthGuard)
 *   me(@CurrentUser() user: { id: string; role: string }) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<{
      user?: { id: string; role: string; deviceId?: string };
    }>();
    return req.user ?? { id: '', role: 'USER' };
  },
);
