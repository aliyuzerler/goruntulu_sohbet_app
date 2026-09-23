import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { AgreementsService } from './agreements.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Ip } from '../common/decorators/ip.decorator';

class AcceptDto {
  @IsUUID()
  agreementId!: string;
}

/**
 * AgreementsController — GET /api/agreements/latest + POST /api/agreements/accept
 */
@Controller('agreements')
export class AgreementsController {
  constructor(private readonly agreements: AgreementsService) {}

  /** Public — no auth required so user can read before login. */
  @Get('latest')
  async latest() {
    return this.agreements.getLatest();
  }

  @Post('accept')
  @UseGuards(JwtAuthGuard)
  async accept(
    @Body() dto: AcceptDto,
    @CurrentUser() user: { id: string },
    @Ip() ip: string,
  ) {
    const ua = await this.agreements.accept({
      userId: user.id,
      agreementId: dto.agreementId,
      ip,
    });
    return { accepted: true, version: ua.versionSnapshot };
  }
}
