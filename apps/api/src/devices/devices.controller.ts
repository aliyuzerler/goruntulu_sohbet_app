import { Body, Controller, Delete, Param, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { DevicesService } from './devices.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

class RegisterDeviceDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  androidId?: string;

  @IsString()
  @MaxLength(256)
  fcmToken!: string;

  @IsIn(['ANDROID', 'IOS', 'WEB'])
  platform!: 'ANDROID' | 'IOS' | 'WEB';

  @IsOptional()
  @IsString()
  @MaxLength(32)
  appVersion?: string;
}

/**
 * DevicesController — POST /api/devices (register), DELETE /api/devices/:id (logout)
 * Single active session per device is enforced by DevicesService + auth refresh rotation.
 */
@Controller('devices')
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Post()
  async register(
    @Body() dto: RegisterDeviceDto,
    @CurrentUser() user: { id: string },
  ) {
    const r = await this.devices.registerDevice({
      userId: user.id,
      androidId: dto.androidId,
      fcmToken: dto.fcmToken,
      platform: dto.platform as never,
      appVersion: dto.appVersion,
    });
    return { deviceId: r.deviceId };
  }

  @Delete(':id')
  async logout(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    await this.devices.revokeTokensForDevice(id);
    return { revoked: true };
  }
}
