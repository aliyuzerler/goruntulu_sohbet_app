import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { RetentionService } from './retention.service';
import { ClaimDailyDto, CreateReferralDto, AdRewardDto, GiftDto, ReconnectDto } from './dto/retention.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/**
 * RetentionController — Phase 11 retention + monetization endpoints.
 *
 *   GET  /api/retention/daily-status  — streak + can-claim-today
 *   POST /api/retention/claim-daily    — claim daily login reward
 *   GET  /api/retention/invite-code    — get or generate invite code
 *   POST /api/retention/referral       — submit invite code (invitee side)
 *   POST /api/retention/ad-reward     — watch ad → 1 coin (3x daily)
 *   POST /api/retention/gift           — in-call gift (coin transfer)
 *   POST /api/retention/reconnect      — request reconnect with last match
 */
@Controller('retention')
@UseGuards(JwtAuthGuard)
export class RetentionController {
  constructor(private readonly retention: RetentionService) {}

  @Get('daily-status')
  async dailyStatus(@CurrentUser() user: { id: string }) {
    return this.retention.getDailyStatus(user.id);
  }

  @Post('claim-daily')
  async claimDaily(@CurrentUser() user: { id: string }) {
    return this.retention.claimDailyLogin(user.id);
  }

  @Get('invite-code')
  async inviteCode(@CurrentUser() user: { id: string }) {
    return this.retention.getOrCreateInviteCode(user.id);
  }

  @Post('referral')
  async createReferral(
    @Body() dto: CreateReferralDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.retention.createReferral({ inviteeId: user.id, inviteCode: dto.inviteCode });
  }

  @Post('ad-reward')
  async adReward(
    @Body() _dto: AdRewardDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.retention.grantAdReward(user.id);
  }

  @Post('gift')
  async gift(
    @Body() dto: GiftDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.retention.sendGift({
      senderId: user.id,
      recipientId: dto.recipientId,
      callId: dto.callId,
      amount: dto.amount,
    });
  }

  @Post('reconnect')
  async reconnect(
    @Body() dto: ReconnectDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.retention.requestReconnect({ userId: user.id, lastCallId: dto.lastCallId });
  }
}
