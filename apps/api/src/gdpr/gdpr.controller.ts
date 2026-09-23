import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { GdprService } from './gdpr.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Ip } from '../common/decorators/ip.decorator';

/**
 * GdprController — KVKK/GDPR data export + deletion.
 *
 *   GET  /api/gdpr/export  — JSON export of all user data (right to portability)
 *   POST /api/gdpr/delete  — schedule anonymization (right to erasure)
 */
@Controller('gdpr')
@UseGuards(JwtAuthGuard)
export class GdprController {
  constructor(private readonly gdpr: GdprService) {}

  @Get('export')
  async export(@CurrentUser() user: { id: string }) {
    return this.gdpr.exportUserData(user.id);
  }

  @Post('delete')
  async delete(
    @CurrentUser() user: { id: string },
    @Ip() _ip: string,
  ) {
    return this.gdpr.scheduleAnonymization({ userId: user.id, reason: 'gdpr_request' });
  }
}
