import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * DailyQuotaService — Redis-backed daily free match counter.
 *
 * Layout:
 *   quota:<userId>:<YYYY-MM-DD>  : integer counter (INCR)
 *   TTL'd until next midnight (server timezone for simplicity).
 *
 * Flow:
 *   1. User opens app, taps Match.
 *   2. Gateway asks canMatchNow(userId).
 *      - If daily count < DAILY_FREE_MATCH_QUOTA → return { ok: true, charge: 0 }
 *      - Else → check if user has COIN_COST_PER_MATCH coins.
 *   3. On successful match, increment the daily counter (if free match) or
 *      debit coins (if paid match).
 *
 * Reset: counter expires at TTL = seconds until next midnight UTC.
 */
@Injectable()
export class DailyQuotaService {
  private readonly logger = new Logger(DailyQuotaService.name);
  private readonly redis: Redis;
  private readonly freeQuota: number;
  private readonly coinCost: number;

  constructor(config: ConfigService) {
    this.freeQuota = config.get<number>('DAILY_FREE_MATCH_QUOTA') ?? 10;
    this.coinCost = config.get<number>('COIN_COST_PER_MATCH') ?? 2;
    this.redis = new Redis(config.get<string>('REDIS_URL')!, {
      connectTimeout: 1000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    this.redis.connect().catch((e) => {
      this.logger.warn(`Redis connect failed (quota): ${e.message}`);
    });
  }

  /**
   * Decide if user can match — either free (within daily quota) or paid
   * (after quota, requires coins).
   *
   * Returns:
   *   { canMatch: true, charge: 0, reason: 'free_quota' }
   *   { canMatch: true, charge: 2, reason: 'paid_match', balanceNeeded: 2 }
   *   { canMatch: false, reason: 'low_balance', needed: 2 }
   */
  async canMatchNow(opts: {
    userId: string;
    currentBalance: number;
  }): Promise<
    | { canMatch: true; charge: number; reason: 'free_quota' | 'paid_match'; remainingFree: number }
    | { canMatch: false; reason: 'low_balance'; needed: number; remainingFree: number }
  > {
    const today = this.todayKey();
    const key = `quota:${opts.userId}:${today}`;
    const usedTodayRaw = await this.redis.get(key).catch(() => '0');
    const usedToday = parseInt(usedTodayRaw ?? '0', 10);
    const remainingFree = Math.max(0, this.freeQuota - usedToday);

    if (remainingFree > 0) {
      return { canMatch: true, charge: 0, reason: 'free_quota', remainingFree };
    }
    if (opts.currentBalance >= this.coinCost) {
      return {
        canMatch: true,
        charge: this.coinCost,
        reason: 'paid_match',
        remainingFree: 0,
      };
    }
    return {
      canMatch: false,
      reason: 'low_balance',
      needed: this.coinCost,
      remainingFree: 0,
    };
  }

  /**
   * Record a successful match — increment the daily counter.
   * Called by MatchmakingService after a match is made + (if paid) coins debited.
   */
  async recordMatch(userId: string): Promise<void> {
    const today = this.todayKey();
    const key = `quota:${userId}:${today}`;
    const p = this.redis.multi();
    p.incr(key);
    p.expireat(key, this.nextMidnightEpoch());
    try {
      await p.exec();
    } catch (e) {
      this.logger.warn(`Quota record failed: ${(e as Error).message}`);
    }
  }

  /** Get the current daily quota usage for a user (for UI display). */
  async getUsage(userId: string): Promise<{ usedToday: number; freeQuota: number; coinCost: number }> {
    const today = this.todayKey();
    const key = `quota:${userId}:${today}`;
    const usedTodayRaw = await this.redis.get(key).catch(() => '0');
    return {
      usedToday: parseInt(usedTodayRaw ?? '0', 10),
      freeQuota: this.freeQuota,
      coinCost: this.coinCost,
    };
  }

  private todayKey(): string {
    const d = new Date();
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private nextMidnightEpoch(): number {
    const d = new Date();
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0));
    return Math.floor(next.getTime() / 1000);
  }
}
