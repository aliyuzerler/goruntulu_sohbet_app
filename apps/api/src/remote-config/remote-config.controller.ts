import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsString } from 'class-validator';
import { RemoteConfigService } from './remote-config.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

class SetConfigDto {
  @IsString()
  key!: string;

  @IsString()
  value!: string;
}

class EmergencyToggleDto {
  @IsBoolean()
  off!: boolean;
}

/**
 * RemoteConfigController — public GET + admin POST.
 *
 *   GET  /api/remote-config      — public, returns subset (minAppVersion, globalMatchingOff, dailyFreeQuota, coinCostPerMatch)
 *   POST /api/remote-config      — admin only, set a key
 *   POST /api/remote-config/emergency-toggle  — admin only, turn off/on global matching
 */
@Controller('remote-config')
export class RemoteConfigController {
  constructor(private readonly remoteConfig: RemoteConfigService) {}

  /** Public — used by the client on boot. */
  @Get()
  async getConfig() {
    return this.remoteConfig.getPublicConfig();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async setConfig(@Body() dto: SetConfigDto) {
    await this.remoteConfig.set(dto.key, dto.value);
    return { ok: true };
  }

  @Post('emergency-toggle')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async emergencyToggle(@Body() dto: EmergencyToggleDto, @CurrentUser() user: { id: string }) {
    if (dto.off) {
      await this.remoteConfig.emergencyStopMatching(`manual by ${user.id}`);
    } else {
      await this.remoteConfig.emergencyResumeMatching();
    }
    return { globalMatchingOff: dto.off };
  }
}
