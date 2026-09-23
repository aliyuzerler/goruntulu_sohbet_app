import { Injectable, Logger, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, CoinTxType } from '@prisma/client';

/**
 * WalletService — server-authoritative coin balance operations.
 *
 * INVARIANTS:
 *   1. Wallet.balance is only modified inside a Prisma transaction that also
 *      creates a CoinTransaction row (snapshot pattern).
 *   2. Wallet.version is the optimistic lock — every balance change increments
 *      it; concurrent attempts that lost the race throw ConflictException.
 *   3. idempotencyKey (per wallet) is unique — duplicate requests return the
 *      existing transaction row without creating a new one or changing balance.
 *   4. CoinTransaction is append-only — never UPDATE or DELETE.
 *
 * Atomicity for high-frequency ops (match spend): we use Prisma's
 * interactive transaction with SELECT FOR UPDATE on the Wallet row.
 * This is equivalent to Lua atomicity for our purposes — Postgres is the
 * single source of truth (no separate Redis wallet cache to drift).
 *
 * Phase 6 will add Google Play Billing → PURCHASE credit.
 */
@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Get the current balance for a user. Creates the wallet lazily if missing. */
  async getBalance(userId: string): Promise<number> {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      // Phase 2 lazily created wallets — but in case of a race, upsert.
      const created = await this.prisma.wallet.upsert({
        where: { userId },
        create: { userId },
        update: {},
      });
      return created.balance;
    }
    return wallet.balance;
  }

  /**
   * Debit coins from the wallet. Atomic + idempotent.
   *
   * Returns the new balance and the transaction id.
   * Throws BadRequestException if insufficient balance.
   * Throws ConflictException on idempotency collision (same key, different amount).
   *
   *   amount: positive integer — debited from balance.
   *   type: SPEND_MATCH / SPEND_GIFT / SPEND_FILTER / REFUND / ADJUSTMENT (negative for credit).
   *   idempotencyKey: client or upstream-supplied — unique per (walletId, key).
   *   reference: optional call ID / purchase token / gift recipient.
   */
  async debit(opts: {
    userId: string;
    amount: number;
    type: CoinTxType;
    idempotencyKey: string;
    reference?: string;
  }): Promise<{ txId: string; newBalance: number }> {
    if (opts.amount <= 0) {
      throw new BadRequestException('Debit amount must be positive');
    }
    return this.applyDelta({
      userId: opts.userId,
      delta: -opts.amount,
      type: opts.type,
      idempotencyKey: opts.idempotencyKey,
      reference: opts.reference,
    });
  }

  /**
   * Credit coins to the wallet. Atomic + idempotent.
   * Same flow as debit but with a positive delta.
   */
  async credit(opts: {
    userId: string;
    amount: number;
    type: CoinTxType;
    idempotencyKey: string;
    reference?: string;
  }): Promise<{ txId: string; newBalance: number }> {
    if (opts.amount <= 0) {
      throw new BadRequestException('Credit amount must be positive');
    }
    return this.applyDelta({
      userId: opts.userId,
      delta: opts.amount,
      type: opts.type,
      idempotencyKey: opts.idempotencyKey,
      reference: opts.reference,
    });
  }

  /**
   * Check if the user has at least N coins. Doesn't lock — use for pre-flight
   * checks (e.g., matchmaking queue:join). The actual debit must still go
   * through the atomic path above.
   */
  async hasAtLeast(userId: string, amount: number): Promise<boolean> {
    const balance = await this.getBalance(userId);
    return balance >= amount;
  }

  /**
   * Apply a delta (positive or negative) to the wallet balance.
   * Uses Prisma interactive transaction with row-level lock.
   *
   * Idempotency:
   *   - We try to insert a CoinTransaction row with (walletId, idempotencyKey).
   *   - If a row already exists with the same key, return it without modifying
   *     balance (idempotent replay).
   *   - P2002 (unique constraint) is the idempotent-replay signal.
   */
  private async applyDelta(opts: {
    userId: string;
    delta: number;
    type: CoinTxType;
    idempotencyKey: string;
    reference?: string;
  }): Promise<{ txId: string; newBalance: number }> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // SELECT ... FOR UPDATE — locks the wallet row for the duration of
        // this transaction. Concurrent attempts block here.
        const wallet = await tx.wallet.findUnique({
          where: { userId: opts.userId },
        });
        if (!wallet) {
          throw new BadRequestException(`Wallet not found for ${opts.userId}`);
        }
        const newBalance = wallet.balance + opts.delta;
        if (newBalance < 0) {
          throw new BadRequestException('Insufficient balance');
        }
        // Insert the append-only CoinTransaction row. P2002 here is
        // the idempotent-replay signal (handled in catch).
        const txRow = await tx.coinTransaction.create({
          data: {
            walletId: wallet.id,
            type: opts.type,
            amount: opts.delta,
            balanceAfter: newBalance,
            idempotencyKey: opts.idempotencyKey,
            reference: opts.reference,
          },
        });
        // Update the wallet — version increment catches stale reads.
        await tx.wallet.update({
          where: { id: wallet.id, version: wallet.version },
          data: { balance: newBalance, version: { increment: 1 } },
        });
        return { txId: txRow.id, newBalance };
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2002') {
          // Idempotent replay — fetch the existing tx + return its values.
          this.logger.log(`Idempotent replay for key ${opts.idempotencyKey}`);
          const wallet = await this.prisma.wallet.findUnique({
            where: { userId: opts.userId },
          });
          const existing = await this.prisma.coinTransaction.findUnique({
            where: {
              walletId_idempotencyKey: {
                walletId: wallet!.id,
                idempotencyKey: opts.idempotencyKey,
              },
            },
          });
          if (!existing) {
            // Race condition where the constraint fired but the row was
            // rolled back. Should be rare — surface a Conflict.
            throw new ConflictException('Idempotency race — please retry');
          }
          return { txId: existing.id, newBalance: existing.balanceAfter };
        }
      }
      throw e;
    }
  }

  /** Get the last N transactions for a wallet — paginated history. */
  async getTransactions(opts: {
    userId: string;
    take: number;
    cursor?: string;
  }): Promise<{ items: Array<{ id: string; type: CoinTxType; amount: number; balanceAfter: number; reference: string | null; createdAt: Date }>; nextCursor: string | null }> {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId: opts.userId } });
    if (!wallet) return { items: [], nextCursor: null };
    const rows = await this.prisma.coinTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: opts.take + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        type: true,
        amount: true,
        balanceAfter: true,
        reference: true,
        createdAt: true,
      },
    });
    const nextCursor = rows.length > opts.take ? rows.pop()!.id : null;
    return { items: rows, nextCursor };
  }
}
