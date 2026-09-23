import { Injectable, Logger, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { GooglePlayService } from './google-play.service';
import { ProductsConfig } from './products.config';
import { CoinTxType } from '@prisma/client';

/**
 * BillingService — server-side Google Play IAP verification + ledger credit.
 *
 * INVARIANTS:
 *   1. Client NEVER authoritative — coins are credited only after the server
 *      verifies the purchase token via the Play Developer API.
 *   2. Idempotency: (orderId) is unique on the Purchase table. Duplicate
 *      verify-purchase requests with the same orderId return the existing
 *      row without re-crediting.
 *   3. Acknowledge: after crediting, we call Play Developer API acknowledge
 *      so the consumable can be bought again.
 *   4. RTDN refund handling: separate method (processRtdn) called by the
 *      webhook controller. Refund → debit (may go negative → flaggedNegative).
 *
 * Phase 6 dev bypass: if GooglePlayService.isConfigured is false (no SA JSON),
 * verify-purchase accepts any token and issues a fake orderId. Useful for CI.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly googlePlay: GooglePlayService,
    private readonly products: ProductsConfig,
  ) {}

  /**
   * Verify a purchase — called by the client after a successful Play purchase.
   *
   * Flow:
   *   1. Look up product config (reject unknown productId).
   *   2. Check if a Purchase row with this orderId already exists → return it (idempotent).
   *   3. Call GooglePlayService.verifyPurchase (idempotent on Play side too).
   *   4. If PURCHASED → WalletService.credit (PURCHASE, idempotencyKey=orderId).
   *   5. Acknowledge the purchase with Google Play.
   *   6. Update Purchase.status = VERIFIED + verifiedAt = now.
   *
   * Returns the final state of the purchase + the new balance.
   */
  async verifyPurchase(opts: {
    userId: string;
    productId: string;
    purchaseToken: string;
  }): Promise<{
    orderId: string;
    productId: string;
    coinsCredited: number;
    status: 'PENDING' | 'PURCHASED' | 'CANCELED' | 'VERIFIED' | 'REFUNDED' | 'VOIDED';
    newBalance: number;
    alreadyProcessed: boolean;
  }> {
    // 1. Look up product config.
    const pack = this.products.findByProductId(opts.productId);
    if (!pack) {
      throw new BadRequestException(`Unknown product ID: ${opts.productId}`);
    }

    // 2. Verify with Google Play — must do this before any DB writes so
    //    we have the canonical orderId.
    const verified = await this.googlePlay.verifyPurchase({
      productId: opts.productId,
      purchaseToken: opts.purchaseToken,
    });

    if (!verified.orderId) {
      throw new BadRequestException('Google Play verify returned no orderId');
    }

    // 3. Check idempotency — if a Purchase with this orderId exists, return it.
    const existing = await this.prisma.purchase.findUnique({
      where: { orderId: verified.orderId },
    });
    if (existing) {
      // Already processed — return current state without re-crediting.
      const balance = await this.wallet.getBalance(opts.userId);
      this.logger.log(`Idempotent replay for orderId=${verified.orderId}`);
      return {
        orderId: existing.orderId,
        productId: existing.productId,
        coinsCredited: existing.coinsCredited,
        status: existing.purchaseState as 'PURCHASED' | 'CANCELED' | 'REFUNDED' | 'VOIDED',
        newBalance: balance,
        alreadyProcessed: true,
      };
    }

    // 4. Reject if purchaseState is CANCELED or PENDING.
    if (verified.purchaseState !== 'PURCHASED') {
      // Still create the row for audit but don't credit.
      await this.prisma.purchase.create({
        data: {
          userId: opts.userId,
          orderId: verified.orderId,
          productId: opts.productId,
          purchaseToken: opts.purchaseToken,
          coinsCredited: 0,
          purchaseState: verified.purchaseState,
        },
      });
      return {
        orderId: verified.orderId,
        productId: opts.productId,
        coinsCredited: 0,
        status: verified.purchaseState,
        newBalance: await this.wallet.getBalance(opts.userId),
        alreadyProcessed: false,
      };
    }

    // 5. Credit the wallet — idempotent (orderId as the idempotency key).
    const credit = await this.wallet.credit({
      userId: opts.userId,
      amount: pack.coins,
      type: CoinTxType.PURCHASE,
      idempotencyKey: `purchase_${verified.orderId}`,
      reference: opts.productId,
    });

    // 6. Create the Purchase row.
    await this.prisma.purchase.create({
      data: {
        userId: opts.userId,
        orderId: verified.orderId,
        productId: opts.productId,
        purchaseToken: opts.purchaseToken,
        coinsCredited: pack.coins,
        purchaseState: 'PURCHASED',
      },
    });

    // 7. Acknowledge with Google Play (so the consumable can be bought again).
    await this.googlePlay.acknowledgePurchase({
      productId: opts.productId,
      purchaseToken: opts.purchaseToken,
    });

    this.logger.log(
      `✓ Verified purchase orderId=${verified.orderId} productId=${opts.productId} → +${pack.coins} coins (user ${opts.userId})`,
    );

    return {
      orderId: verified.orderId,
      productId: opts.productId,
      coinsCredited: pack.coins,
      status: 'VERIFIED',
      newBalance: credit.newBalance,
      alreadyProcessed: false,
    };
  }

  /**
   * Process a Real-Time Developer Notification (RTDN) from Google Pub/Sub.
   *
   *   - ONE_TIME_PRODUCT_PURCHASED: customer bought a consumable (already
   *     handled by verify-purchase; this is just a confirmation).
   *   - ONE_TIME_PRODUCT_CANCELED: purchase was reversed before delivery.
   *   - REFUNDED: Google issued a refund — debit the coins back.
   *   - VOIDED: test purchase voided — same handling as REFUNDED.
   *
   * Refund flow:
   *   1. Look up Purchase by purchaseToken.
   *   2. If not found → no-op (we didn't process this purchase; ignore).
   *   3. Debit the wallet by coinsCredited (REFUND type, idempotencyKey=refund_<orderId>).
   *   4. If balance goes negative → set Wallet.flaggedNegative = true.
   *   5. Update Purchase.purchaseState = REFUNDED + refundedAt + lastRtdnPayload.
   */
  async processRtdn(opts: {
    purchaseToken: string;
    notificationType: 'ONE_TIME_PRODUCT_PURCHASED' | 'ONE_TIME_PRODUCT_CANCELED' | 'REFUNDED' | 'VOIDED';
    payload: unknown;
  }): Promise<{ handled: boolean; reason?: string }> {
    const purchase = await this.prisma.purchase.findUnique({
      where: { purchaseToken: opts.purchaseToken },
    });
    if (!purchase) {
      // We didn't process this purchase — likely a test or out-of-band purchase.
      return { handled: false, reason: 'purchase_not_found' };
    }

    if (opts.notificationType === 'ONE_TIME_PRODUCT_PURCHASED') {
      // Already handled by verify-purchase — no-op.
      return { handled: true, reason: 'purchase_already_processed' };
    }

    if (opts.notificationType === 'ONE_TIME_PRODUCT_CANCELED') {
      await this.prisma.purchase.update({
        where: { id: purchase.id },
        data: {
          purchaseState: 'CANCELED',
          lastRtdnPayload: opts.payload as never,
        },
      });
      return { handled: true, reason: 'canceled' };
    }

    if (opts.notificationType === 'REFUNDED' || opts.notificationType === 'VOIDED') {
      // Debit the coins back — may go negative.
      try {
        const result = await this.wallet.debit({
          userId: purchase.userId,
          amount: purchase.coinsCredited,
          type: CoinTxType.REFUND,
          idempotencyKey: `refund_${purchase.orderId}`,
          reference: purchase.productId,
        });
        // If newBalance < 0, flag the wallet.
        if (result.newBalance < 0) {
          await this.prisma.wallet.update({
            where: { userId: purchase.userId },
            data: { negativeBalance: true },
          });
          this.logger.warn(
            `Wallet ${purchase.userId} went negative (${result.newBalance}) after refund of ${purchase.coinsCredited}`,
          );
        }
      } catch (e) {
        // Insufficient balance — but we WANT to go negative here. WalletService.debit
        // rejects negative balance; we need a separate code path for refunds.
        if (e instanceof Error && e.message.includes('Insufficient')) {
          // Force the debit via a direct prisma transaction — bypass WalletService's
          // positive-balance invariant.
          await this.forceDebitNegative({
            userId: purchase.userId,
            amount: purchase.coinsCredited,
            idempotencyKey: `refund_${purchase.orderId}`,
            reference: purchase.productId,
          });
          this.logger.warn(
            `Wallet ${purchase.userId} went negative after refund of ${purchase.coinsCredited} (forced)`,
          );
        } else {
          throw e;
        }
      }

      await this.prisma.purchase.update({
        where: { id: purchase.id },
        data: {
          purchaseState: opts.notificationType === 'REFUNDED' ? 'REFUNDED' : 'VOIDED',
          refundedAt: new Date(),
          lastRtdnPayload: opts.payload as never,
        },
      });

      this.logger.log(
        `✓ RTDN ${opts.notificationType} for orderId=${purchase.orderId} → -${purchase.coinsCredited} coins`,
      );
      return { handled: true, reason: opts.notificationType.toLowerCase() };
    }

    return { handled: false, reason: 'unknown_notification_type' };
  }

  /**
   * Force a debit that may go negative — used for refunds only.
   * Same atomic pattern as WalletService.applyDelta but allows negative.
   */
  private async forceDebitNegative(opts: {
    userId: string;
    amount: number;
    idempotencyKey: string;
    reference?: string;
  }): Promise<{ newBalance: number }> {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId: opts.userId } });
      if (!wallet) throw new NotFoundException('Wallet not found');
      const newBalance = wallet.balance - opts.amount;
      // Insert CoinTransaction (idempotency key prevents double-debit).
      await tx.coinTransaction.create({
        data: {
          walletId: wallet.id,
          type: CoinTxType.REFUND,
          amount: -opts.amount,
          balanceAfter: newBalance,
          idempotencyKey: opts.idempotencyKey,
          reference: opts.reference,
        },
      });
      await tx.wallet.update({
        where: { id: wallet.id, version: wallet.version },
        data: { balance: newBalance, version: { increment: 1 }, negativeBalance: newBalance < 0 },
      });
      return { newBalance };
    });
  }

  /** Get all purchases for a user — admin dashboard + user history. */
  async listPurchases(opts: { userId: string; take?: number }): Promise<unknown[]> {
    return this.prisma.purchase.findMany({
      where: { userId: opts.userId },
      orderBy: { createdAt: 'desc' },
      take: opts.take ?? 50,
      select: {
        id: true,
        orderId: true,
        productId: true,
        coinsCredited: true,
        purchaseState: true,
        refundedAt: true,
        voidedAt: true,
        createdAt: true,
      },
    });
  }
}
