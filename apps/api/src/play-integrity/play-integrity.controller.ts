import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { PlayIntegrityService } from './play-integrity.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

class VerifyTokenDto {
  @IsString()
  @MaxLength(4096)
  requestToken!: string;
}

/**
 * PlayIntegrityController — verify Play Integrity tokens.
 *
 *   POST /api/play-integrity/verify  — client sends requestToken after Play Integrity API call.
 */
@Controller('play-integrity')
@UseGuards(JwtAuthGuard)
export class PlayIntegrityController {
  constructor(private readonly playIntegrity: PlayIntegrityService) {}

  @Post('verify')
  async verify(
    @Body() dto: VerifyTokenDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.playIntegrity.verifyToken({
      userId: user.id,
      requestToken: dto.requestToken,
    });
  }
}
