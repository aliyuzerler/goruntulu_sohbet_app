import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Ip } from '../common/decorators/ip.decorator';

class SearchUsersDto {
  @IsString()
  q!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  take?: number;
}

class AdjustCoinsDto {
  @IsInt()
  delta!: number;

  @IsString()
  @Min(3, { message: 'note must be at least 3 characters — mandatory for audit' })
  @MaxLength(500)
  note!: string;
}

class BroadcastFcmDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  @MaxLength(1000)
  body!: string;

  @IsIn(['all', 'vip', 'country'])
  targetType!: 'all' | 'vip' | 'country';

  @IsOptional()
  @IsString()
  countryCode?: string;
}

/**
 * AdminController — admin panel endpoints.
 *
 *   MODERATOR can: view dashboard, search users, view user detail, view audit log.
 *   ADMIN can: everything MODERATOR + adjust coins, broadcast FCM, ban/unban.
 *
 * All write actions are AuditLog'd.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // ─── Dashboard ─────────────────────────────────────────────────────────

  @Get('dashboard/kpis')
  @Roles('MODERATOR', 'ADMIN')
  async kpis() {
    return this.admin.getDashboardKPIs();
  }

  @Get('dashboard/7day')
  @Roles('MODERATOR', 'ADMIN')
  async sevenDay() {
    return this.admin.getDashboard7DaySeries();
  }

  // ─── User management ───────────────────────────────────────────────────

  @Get('users/search')
  @Roles('MODERATOR', 'ADMIN')
  async searchUsers(@Query() dto: SearchUsersDto) {
    return this.admin.searchUsers(dto.q, dto.take ?? 20);
  }

  @Get('users/:id')
  @Roles('MODERATOR', 'ADMIN')
  async getUserDetail(@Param('id') id: string) {
    return this.admin.getUserDetail(id);
  }

  @Post('users/:id/adjust-coins')
  @Roles('ADMIN')
  async adjustCoins(
    @Param('id') id: string,
    @Body() dto: AdjustCoinsDto,
    @CurrentUser() user: { id: string },
    @Ip() ip: string,
  ) {
    return this.admin.adjustCoins({
      userId: id,
      adminUserId: user.id,
      delta: dto.delta,
      note: dto.note,
      ip,
    });
  }

  @Post('users/:id/ban')
  @Roles('ADMIN')
  async banUser(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: { id: string },
    @Ip() ip: string,
  ) {
    await this.admin.moderation.banUser({ userId: id, adminUserId: user.id, reason, ip });
    return { banned: true };
  }

  @Post('users/:id/unban')
  @Roles('ADMIN')
  async unbanUser(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: { id: string },
    @Ip() ip: string,
  ) {
    await this.admin.moderation.unbanUser({ userId: id, adminUserId: user.id, reason, ip });
    return { unbanned: true };
  }

  // ─── FCM broadcast ─────────────────────────────────────────────────────

  @Post('broadcast')
  @Roles('ADMIN')
  async broadcast(
    @Body() dto: BroadcastFcmDto,
    @CurrentUser() user: { id: string },
    @Ip() ip: string,
  ) {
    return this.admin.broadcastFcm({
      adminUserId: user.id,
      title: dto.title,
      body: dto.body,
      target: dto.targetType === 'country' ? { country: dto.countryCode ?? '??' } : dto.targetType,
      ip,
    });
  }

  // ─── Audit log ─────────────────────────────────────────────────────────

  @Get('audit-log')
  @Roles('MODERATOR', 'ADMIN')
  async auditLog(@Query('cursor') cursor?: string, @Query('take') take?: string) {
    return this.admin.getAuditLog(take ? parseInt(take, 10) : 50, cursor);
  }
}
