import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { GooglePlayService } from '../billing/google-play.service';

/**
 * EntitlementService — tracks whether a user currently has VIP status.
 *
 * isActive(userId) is the canonical "is this user VIP?" check used by:
 *   - Matchmaking (gender filter + free country filter)
 *   - /me (badge display)
 *   - Profile setup (badge display)
 *
 * The check is:
 *   1. Find Entitlement row for user.
 *   2. status in (ACTIVE, CANCELED, GRACE) AND expiresAt > now.
 *
 * CANCELED still gives VIP until the paid period ends (Google's billing model).
 * GRACE is the billing-retry window — Google hasn't charged yet but the user
 * still gets VIP. EXPIRED means the subscription lapsed.
 */
@Injectable()
export class EntitlementService {
  private readonly logger = new Logger(EntitlementService.name);
  private readonly vipProductId: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly googlePlay: GooglePlayService,
    config: ConfigService,
  ) {
    this.vipProductId = config.get<string>('VIP_PRODUCT_ID') ?? 'vip_monthly';
  }

  /** True if the user currently has VIP status (regardless of cancellation). */
  async isActive(userId: string): Promise<boolean> {
    const ent = await this.prisma.entitlement.findUnique({ where: { userId } });
    if (!ent) return false;
    if (!['ACTIVE', 'CANCELED', 'GRACE'].includes(ent.status)) return false;
    if (ent.expiresAt.getTime() < Date.now()) return false;
    return true;
  }

  /**
   * Verify a subscription purchase token from the client and activate VIP.
   *
   * Flow:
   *   1. Call Google Play subscriptionsv2.get → returns canonical state + expiresAt.
   *   2. Upsert Entitlement row (purchaseToken unique — idempotent replay).
   *   3. Return the entitlement state.
   */
  async verifySubscription(opts: {
    userId: string;
    purchaseToken: string;
  }): Promise<{
    status: 'ACTIVE' | 'CANCELED' | 'EXPIRED' | 'GRACE' | 'UNKNOWN';
    expiresAt: Date | null;
    productId: string | null;
    alreadyProcessed: boolean;
  }> {
    const verified = await this.googlePlay.verifySubscription({
      purchaseToken: opts.purchaseToken,
    });

    // Idempotency check: if the entitlement already has this purchaseToken,
    // this is a replay — return the existing state.
    const existing = await this.prisma.entitlement.findUnique({
      where: { purchaseToken: opts.purchaseToken },
    });
    if (existing && existing.userId === opts.userId) {
      return {
        status: existing.status as 'ACTIVE' | 'CANCELED' | 'EXPIRED' | 'GRACE' | 'UNKNOWN',
        expiresAt: existing.expiresAt,
        productId: existing.productId,
        alreadyProcessed: true,
      };
    }
    if (existing && existing.userId !== opts.userId) {
      // purchaseToken belongs to a different user — reject to prevent transfer.
      throw new BadRequestException('Subscription token mismatch');
    }

    // Upsert the Entitlement row.
    const expiresAt = verified.expiresAt ?? new Date();
    const row = await this.prisma.entitlement.upsert({
      where: { userId: opts.userId },
      create: {
        userId: opts.userId,
        purchaseToken: opts.purchaseToken,
        productId: verified.productId ?? this.vipProductId,
        status: verified.state,
        expiresAt,
      },
      update: {
        purchaseToken: opts.purchaseToken,
        productId: verified.productId ?? this.vipProductId,
        status: verified.state,
        expiresAt,
      },
    });
    this.logger.log(
      `✓ VIP ${row.status} for user ${opts.userId} (expires ${row.expiresAt.toISOString()})`,
    );
    return {
      status: row.status as 'ACTIVE' | 'CANCELED' | 'EXPIRED' | 'GRACE' | 'UNKNOWN',
      expiresAt: row.expiresAt,
      productId: row.productId,
      alreadyProcessed: false,
    };
  }

  /**
   * Process a RTDN subscription notification.
   *
   * Notification types:
   *   - SUBSCRIPTION_RECOVERED: subscription recovered from account hold
   *   - SUBSCRIPTION_RENEWED: renewed successfully
   *   - SUBSCRIPTION_CANCELED: user canceled (still active until expiresAt)
   *   - SUBSCRIPTION_EXPIRED: subscription ended
   *   - SUBSCRIPTION_ON_HOLD: account hold (billing failed)
   *   - SUBSCRIPTION_GRACE_PERIOD_ENDS: about to expire
   *
   * For each, we re-call GooglePlayService.verifySubscription to get the
   * canonical state — RTDN notifications don't include the state directly,
   * they're just signals to refresh.
   */
  async processSubscriptionRtdn(opts: {
    purchaseToken: string;
    notificationType: string;
    payload: unknown;
  }): Promise<{ handled: boolean; reason?: string }> {
    const ent = await this.prisma.entitlement.findUnique({
      where: { purchaseToken: opts.purchaseToken },
    });
    if (!ent) {
      // We don't have this subscription — possibly a test or out-of-band purchase.
      return { handled: false, reason: 'entitlement_not_found' };
    }
    // Re-verify with Google to get the canonical state.
    try {
      const verified = await this.googlePlay.verifySubscription({
        purchaseToken: opts.purchaseToken,
      });
      const expiresAt = verified.expiresAt ?? ent.expiresAt;
      await this.prisma.entitlement.update({
        where: { id: ent.id },
        data: {
          status: verified.state,
          expiresAt,
          canceledAt:
            opts.notificationType === 'SUBSCRIPTION_CANCELED'
              ? new Date()
              : ent.canceledAt,
          expiredAt:
            opts.notificationType === 'SUBSCRIPTION_EXPIRED'
              ? new Date()
              : ent.expiredAt,
          lastRtdnAt: new Date(),
          lastRtdnPayload: opts.payload as never,
        },
      });
      this.logger.log(
        `RTDN ${opts.notificationType} for entitlement ${ent.id} → state ${verified.state}`,
      );
      return { handled: true, reason: opts.notificationType.toLowerCase() };
    } catch (e) {
      this.logger.warn(
        `RTDN subscription verify failed for ${ent.id}: ${(e as Error).message}`,
      );
      return { handled: false, reason: 'verify_failed' };
    }
  }

  /** Cron-sweep: find entitlements whose expiresAt < now but still marked ACTIVE — flip to EXPIRED. */
  async expireOverdueEntitlements(): Promise<number> {
    const now = new Date();
    const result = await this.prisma.entitlement.updateMany({
      where: {
        status: { in: ['ACTIVE', 'CANCELED', 'GRACE'] },
        expiresAt: { lt: now },
      },
      data: { status: 'EXPIRED', expiredAt: now },
    });
    if (result.count > 0) {
      this.logger.log(`✓ Expired ${result.count} overdue entitlements`);
    }
    return result.count;
  }

  /** Get entitlement summary for /me endpoint. */
  async getEntitlement(userId: string): Promise<{
    status: string | null;
    expiresAt: Date | null;
    isActive: boolean;
  }> {
    const ent = await this.prisma.entitlement.findUnique({ where: { userId } });
    if (!ent) return { status: null, expiresAt: null, isActive: false };
    const active = await this.isActive(userId);
    return { status: ent.status, expiresAt: ent.expiresAt, isActive: active };
  }
}
