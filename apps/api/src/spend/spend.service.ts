import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { WalletService } from '../wallet/wallet.service';
import { CoinTxType } from '@prisma/client';

/**
 * SpendService — application-layer wrapper over WalletService for spend
 * operations. Provides domain-specific methods (match, gift, filter) that
 * build the right idempotencyKey + CoinTxType + reference.
 *
 * Phase 6: MatchmakingService uses this instead of calling WalletService
 * directly. Keeps the spend patterns consistent across callers.
 *
 * Atomicity: SpendService is a thin wrapper — atomicity comes from
 * WalletService.debit which uses Prisma $transaction + SELECT FOR UPDATE.
 */
@Injectable()
export class SpendService {
  private readonly logger = new Logger(SpendService.name);

  constructor(private readonly wallet: WalletService) {}

  /**
   * Spend coins for a random match.
   * Idempotency: (walletId, idempotencyKey=match_<callId>_<userId>) unique.
   *   - If the call ends + user taps Next + matchmaking tries to charge again
   *     with the same idempotencyKey → no-op replay.
   *
   * Throws BadRequestException if insufficient balance. Caller (matchmaking)
   * should treat this as the signal to emit low_balance.
   */
  async spendMatch(opts: {
    userId: string;
    callId: string;
    amount: number;
  }): Promise<{ txId: string; newBalance: number }> {
    if (opts.amount <= 0) {
      // Free match (within daily quota) — no spend.
      return { txId: '', newBalance: await this.wallet.getBalance(opts.userId) };
    }
    try {
      return await this.wallet.debit({
        userId: opts.userId,
        amount: opts.amount,
        type: CoinTxType.SPEND_MATCH,
        idempotencyKey: `match_${opts.callId}_${opts.userId}`,
        reference: opts.callId,
      });
    } catch (e) {
      this.logger.warn(
        `Spend failed for match: user=${opts.userId} callId=${opts.callId} amount=${opts.amount} err=${(e as Error).message}`,
      );
      throw e;
    }
  }

  /**
   * Spend coins for a gift to another user. Atomic — debits sender + credits
   * recipient in one Prisma transaction (Phase 8 will add a direct call to
   * WalletService.credit here; Phase 6 ships the debit only).
   */
  async spendGift(opts: {
    senderUserId: string;
    recipientUserId: string;
    giftId: string; // for idempotency
    amount: number;
  }): Promise<{ txId: string; newBalance: number }> {
    return this.wallet.debit({
      userId: opts.senderUserId,
      amount: opts.amount,
      type: CoinTxType.SPEND_GIFT,
      idempotencyKey: `gift_${opts.giftId}_${opts.senderUserId}`,
      reference: opts.recipientUserId,
    });
  }

  /**
   * Spend coins for a gender / country filter on the matchmaking queue.
   */
  async spendFilter(opts: {
    userId: string;
    filterType: string; // "gender" | "country"
    amount: number;
  }): Promise<{ txId: string; newBalance: number }> {
    return this.wallet.debit({
      userId: opts.userId,
      amount: opts.amount,
      type: CoinTxType.SPEND_FILTER,
      idempotencyKey: `filter_${opts.filterType}_${opts.userId}_${Date.now()}`,
      reference: opts.filterType,
    });
  }
}
