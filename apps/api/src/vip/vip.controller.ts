import { Body, Controller, Get, Headers, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsString, MaxLength } from 'class-validator';
import { EntitlementService } from './entitlement.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

class VerifySubscriptionDto {
  @IsString()
  @MaxLength(512)
  purchaseToken!: string;
}

/**
 * VipController — VIP subscription endpoints.
 *
 *   POST /api/vip/verify-subscription  — client → server subscription verification
 *   GET  /api/vip/status                — current entitlement state for the user
 *   POST /api/vip/rtdn-webhook          — Google Pub/Sub subscription notifications
 */
@Controller('vip')
export class VipController {
  constructor(
    private readonly entitlement: EntitlementService,
    private readonly config: ConfigService,
  ) {}

  @Post('verify-subscription')
  @UseGuards(JwtAuthGuard)
  async verifySubscription(
    @Body() dto: VerifySubscriptionDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.entitlement.verifySubscription({
      userId: user.id,
      purchaseToken: dto.purchaseToken,
    });
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async status(@CurrentUser() user: { id: string }) {
    return this.entitlement.getEntitlement(user.id);
  }

  /**
   * POST /api/vip/rtdn-webhook — subscription-only RTDN endpoint.
   * Same auth pattern as /billing/rtdn-webhook (Bearer secret).
   * Phase 7: subscription notifications are routed here from the main billing
   * webhook via an HTTP forwarding call (or Google Pub/Sub can be configured to
   * push to two endpoints).
   */
  @Post('rtdn-webhook')
  async rtdnWebhook(
    @Body() body: unknown,
    @Headers('authorization') authHeader: string,
  ) {
    const expected = this.config.get<string>('GOOGLE_PLAY_WEBHOOK_SECRET') ?? '';
    if (expected && authHeader !== `Bearer ${expected}`) {
      return { verified: false, reason: 'auth_failed' };
    }
    const envelope = body as { message?: { data?: string } };
    const dataB64 = envelope?.message?.data;
    if (!dataB64) return { handled: false, reason: 'no_message_data' };
    let payload: unknown;
    try {
      payload = JSON.parse(Buffer.from(dataB64, 'base64').toString('utf-8'));
    } catch {
      return { handled: false, reason: 'bad_base64' };
    }
    const p = payload as {
      subscriptionNotification?: {
        purchaseToken?: string;
        notificationType?: string;
      };
    };
    if (p.subscriptionNotification?.purchaseToken && p.subscriptionNotification?.notificationType) {
      const result = await this.entitlement.processSubscriptionRtdn({
        purchaseToken: p.subscriptionNotification.purchaseToken,
        notificationType: p.subscriptionNotification.notificationType,
        payload,
      });
      return result;
    }
    return { handled: false, reason: 'no_subscription_notification' };
  }
}
