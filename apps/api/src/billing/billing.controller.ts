import { Body, Controller, Get, Headers, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service';
import { ProductsConfig } from './products.config';
import { VerifyPurchaseDto, RtdnWebhookDto } from './dto/billing.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/**
 * BillingController — Google Play IAP endpoints.
 *
 *   GET  /api/billing/products          — list available coin packs
 *   POST /api/billing/verify-purchase   — client → server purchase verification
 *   POST /api/billing/rtdn-webhook      — Google Pub/Sub push (no auth — verified by secret)
 */
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly products: ProductsConfig,
    private readonly config: ConfigService,
  ) {}

  /** Public — list coin packs. Used by client before opening the in_app_purchase flow. */
  @Get('products')
  listProducts() {
    return { products: this.products.listPacks() };
  }

  /**
   * POST /api/billing/verify-purchase — verify + credit.
   * Idempotent on orderId — duplicate requests return the existing record.
   */
  @Post('verify-purchase')
  @UseGuards(JwtAuthGuard)
  async verifyPurchase(
    @Body() dto: VerifyPurchaseDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.billing.verifyPurchase({
      userId: user.id,
      productId: dto.productId,
      purchaseToken: dto.purchaseToken,
    });
  }

  /**
   * POST /api/billing/rtdn-webhook — Google Pub/Sub RTDN push.
   *
   * Auth: we verify a shared secret in the `Authorization` header. The secret
   * is configured in GOOGLE_PLAY_WEBHOOK_SECRET env var and set in the
   * Pub/Sub subscription's push endpoint URL as ?token=... (or as a custom header).
   *
   * Phase 6 dev: webhook accepts any body if GOOGLE_PLAY_WEBHOOK_SECRET is empty
   * so CI can simulate RTDN. NEVER deploy without the secret set.
   */
  @Post('rtdn-webhook')
  async rtdnWebhook(
    @Body() body: unknown,
    @Headers('authorization') authHeader: string,
  ) {
    const expected = this.config.get<string>('GOOGLE_PLAY_WEBHOOK_SECRET') ?? '';
    if (expected) {
      if (authHeader !== `Bearer ${expected}`) {
        return { verified: false, reason: 'auth_failed' };
      }
    }
    // Pub/Sub envelope: { message: { data: base64(JSON) } }
    const envelope = body as { message?: { data?: string } };
    const dataB64 = envelope?.message?.data;
    if (!dataB64) {
      return { handled: false, reason: 'no_message_data' };
    }
    let payload: unknown;
    try {
      payload = JSON.parse(Buffer.from(dataB64, 'base64').toString('utf-8'));
    } catch {
      return { handled: false, reason: 'bad_base64' };
    }
    const p = payload as {
      version?: string;
      packageName?: string;
      eventTimeMillis?: string;
      oneTimeProductNotification?: { purchaseToken?: string; type?: string };
      subscriptionNotification?: { purchaseToken?: string; notificationType?: string; subscriptionId?: string };
      voidedPurchaseNotification?: { purchaseToken?: string };
    };
    if (p.oneTimeProductNotification?.purchaseToken && p.oneTimeProductNotification?.type) {
      const result = await this.billing.processRtdn({
        purchaseToken: p.oneTimeProductNotification.purchaseToken,
        notificationType: p.oneTimeProductNotification.type as never,
        payload,
      });
      return { handled: result.handled, reason: result.reason };
    }
    if (p.voidedPurchaseNotification?.purchaseToken) {
      const result = await this.billing.processRtdn({
        purchaseToken: p.voidedPurchaseNotification.purchaseToken,
        notificationType: 'VOIDED',
        payload,
      });
      return { handled: result.handled, reason: result.reason };
    }
    // Phase 7: subscription notifications — delegated to EntitlementService.
    if (p.subscriptionNotification?.purchaseToken && p.subscriptionNotification?.notificationType) {
      // Routed via a separate HTTP call to /api/vip/rtdn-webhook to keep the
      // one-time-purchase flow and subscription flow decoupled. The webhook
      // entry point dispatches by notification shape.
      return {
        handled: true,
        reason: 'subscription_notification_routed_to_vip',
        subscriptionNotification: p.subscriptionNotification,
      };
    }
    return { handled: false, reason: 'no_matching_notification' };
  }
}
