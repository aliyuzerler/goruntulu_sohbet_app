import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { WalletService } from '../wallet/wallet.service';
import { CoinTxType } from '@prisma/client';

/**
 * SpendService — Phase 6 refactor: matchmaking + gift + filter spend all go
 * through this service, not directly through WalletService.
 *
 * Why the indirection:
 *   - WalletService.debit is generic — doesn't enforce the rules that each
 *     spend domain needs (idempotency key pattern, reference shape).
 *   - SpendService provides per-domain API + audit-friendly reference.
 *   - Phase 8 admin can call SpendService.refundSpend(userId, callId) to
 *     reverse a match spend without poking the wallet directly.
 *
 * Atomicity: SpendService delegates to WalletService.debit which uses
 * Prisma $transaction + SELECT FOR UPDATE + optimistic version.
 */
@Injectable()
export class SpendService {
  private readonly logger = new Logger(SpendService.name);

  constructor(private readonly wallet: WalletService) {}

  /**
   * Charge coins for a match.
   *
   *   userId: the user being charged
   *   callId: the call this charge is for (also serves as part of the idempotency key)
   *   amount: coins to charge (from ProductsConfig.COIN_COST_PER_MATCH)
   *
   * Returns { newBalance, txId, alreadyDebited: true if idempotent replay }.
   * Throws BadRequestException if insufficient balance.
   */
  async spendMatch(opts: {
    userId: string;
    callId: string;
    amount: number;
  }): Promise<{ txId: string; newBalance: number; alreadyDebited: boolean }> {
    if (opts.amount <= 0) {
      throw new BadRequestException('Match spend amount must be positive');
    }
    const idempotencyKey = `match_${opts.callId}_${opts.userId}`;
    try {
      const r = await this.wallet.debit({
        userId: opts.userId,
        amount: opts.amount,
        type: CoinTxType.SPEND_MATCH,
        idempotencyKey,
        reference: opts.callId,
      });
      return { ...r, alreadyDebited: false };
    } catch (e) {
      // Idempotent replay — wallet.debit throws ConflictException on P2002.
      // That's actually the idempotent-replay signal — return existing state.
      if (e instanceof Error && e.message.includes('Idempotency')) {
        this.logger.log(`Idempotent replay for ${idempotencyKey}`);
        const balance = await this.wallet.getBalance(opts.userId);
        return { txId: '', newBalance: balance, alreadyDebited: true };
      }
      throw e;
    }
  }

  /** Charge for sending a gift to another user. */
  async spendGift(opts: {
    userId: string;
    recipientId: string;
    amount: number;
    giftId: string;
  }): Promise<{ txId: string; newBalance: number }> {
    const idempotencyKey = `gift_${opts.giftId}_${opts.userId}_${opts.recipientId}`;
    const r = await this.wallet.debit({
      userId: opts.userId,
      amount: opts.amount,
      type: CoinTxType.SPEND_GIFT,
      idempotencyKey,
      reference: opts.giftId,
    });
    return r;
  }

  /** Charge for a gender/region filter. */
  async spendFilter(opts: {
    userId: string;
    filterType: string;
    amount: number;
    filterId: string;
  }): Promise<{ txId: string; newBalance: number }> {
    const idempotencyKey = `filter_${opts.filterId}_${opts.userId}`;
    const r = await this.wallet.debit({
      userId: opts.userId,
      amount: opts.amount,
      type: CoinTxType.SPEND_FILTER,
      idempotencyKey,
      reference: opts.filterId,
    });
    return r;
  }
}
