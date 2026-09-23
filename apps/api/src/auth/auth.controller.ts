import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  VerifyPhoneDto,
  VerifyGoogleDto,
  RefreshDto,
  LogoutDto,
  AdminLoginDto,
} from './dto/auth.dto';
import { AuthService } from './auth.service';
import { RateLimit } from '../security/decorators/rate-limit.decorator';
import { Ip } from '../common/decorators/ip.decorator';

/**
 * AuthController — public endpoints under /api/auth/*.
 *
 * Rate limited:
 *   - verify-phone, verify-google: 5 per IP per 10 min (OTP abuse)
 *   - refresh: 30 per IP per 10 min (rotation shouldn't be too aggressive)
 *   - admin/login: 5 per IP per 10 min (brute-force)
 *
 * Logout is not rate-limited (idempotent + cheap).
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('verify-phone')
  @RateLimit({ key: 'verify-phone', limit: 5, windowSec: 600 })
  async verifyPhone(@Body() dto: VerifyPhoneDto, @Ip() ip: string) {
    return this.auth.loginWithPhone({
      idToken: dto.idToken,
      phone: dto.phone,
      androidId: dto.androidId,
      fcmToken: dto.fcmToken,
      appVersion: dto.appVersion,
      ip,
    });
  }

  @Post('verify-google')
  @RateLimit({ key: 'verify-google', limit: 5, windowSec: 600 })
  async verifyGoogle(@Body() dto: VerifyGoogleDto, @Ip() ip: string) {
    return this.auth.loginWithGoogle({
      idToken: dto.idToken,
      androidId: dto.androidId,
      fcmToken: dto.fcmToken,
      appVersion: dto.appVersion,
      ip,
    });
  }

  @Post('refresh')
  @RateLimit({ key: 'refresh', limit: 30, windowSec: 600 })
  async refresh(@Body() dto: RefreshDto, @Ip() ip: string) {
    return this.auth.refresh({ refreshToken: dto.refreshToken, ip });
  }

  @Post('logout')
  async logout(@Body() dto: LogoutDto) {
    await this.auth.logout({ refreshToken: dto.refreshToken });
    return { ok: true };
  }

  @Post('admin/login')
  @RateLimit({ key: 'admin-login', limit: 5, windowSec: 600 })
  async adminLogin(@Body() dto: AdminLoginDto, @Ip() ip: string) {
    return this.auth.loginAdmin({ email: dto.email, password: dto.password, totpCode: dto.totpCode, ip });
  }
}
