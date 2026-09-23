import { SetMetadata } from '@nestjs/common';

/**
 * @Roles('ADMIN', 'MODERATOR') — annotates a route with required roles.
 * Parsed by RolesGuard. Combine with @UseGuards(JwtAuthGuard, RolesGuard).
 */
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
