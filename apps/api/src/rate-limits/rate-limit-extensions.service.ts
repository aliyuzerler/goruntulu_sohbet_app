import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';

/**
 * RateLimitExtensionsService — Phase 9 specific rate limits:
 *   1. Report spam weight: if reporter A has >N reports against same target B in 24h,
 *      weight of new reports drops to 0.1 (counter-attack defense — prevents
 *      "mass report to lower someone's rating" attack).
 *   2. WS message limit: 30 messages per socket per 10s.
 *
 * Redis layout:
 *   report-spam:<reporterId>:<targetId>:<day> — INCR, EXPIRE midnight.
 *     If count > REPORT_WEIGHT_DECAY_THRESHOLD (default 5) → weight = 0.1.
 *   ws-msg:<socketId>:<windowId> — INCR, EXPIRE 10s.
 *     If count > WS_MSG_LIMIT_PER_10S (default 30) → reject.
 */
@Injectable()
export class RateLimitExtensionsService {
  private readonly logger = new Logger(RateLimitExtensionsService.name);
  private readonly redis: Redis;
  private readonly reportDecayThreshold: number;
  private readonly reportDecayedWeight: number;
  private readonly wsMsgLimit: number;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.reportDecayThreshold = config.get<number>('REPORT_WEIGHT_DECAY_THRESHOLD') ?? 5;
    this.reportDecayedWeight = config.get<number>('REPORT_DECAYED_WEIGHT') ?? 0.1;
    this.wsMsgLimit = config.get<number>('WS_MSG_LIMIT_PER_10S') ?? 30;
    this.redis = new Redis(config.get<string>('REDIS_URL')!, {
      connectTimeout: 1000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    this.redis.connect().catch((e) => {
      this.logger.warn(`Redis connect failed (rate-limit-ext): ${e.message}`);
    });
  }

  /**
   * Compute the weight of a report from `reporterId` about `targetId`.
   *   - If reporter has <threshold reports against target in 24h → weight=1.0
   *   - If reporter has >=threshold reports against target in 24h → weight=0.1 (decayed)
   *
   * Counter-attack defense: prevents a user from mass-reporting another user to
   * get them banned. The reports are still stored, but their effective weight
   * in admin KPI dashboards is reduced.
   */
  async getReportWeight(opts: {
    reporterId: string;
    targetId: string;
  }): Promise<{ weight: number; reason: 'fresh' | 'decayed' }> {
    const today = this.todayKey();
    const key = `report-spam:${opts.reporterId}:${opts.targetId}:${today}`;
    try {
      const count = parseInt((await this.redis.get(key)) ?? '0', 10);
      if (count >= this.reportDecayThreshold) {
        return { weight: this.reportDecayedWeight, reason: 'decayed' };
      }
      return { weight: 1.0, reason: 'fresh' };
    } catch {
      return { weight: 1.0, reason: 'fresh' };
    }
  }

  /**
   * Increment the report counter for a (reporter, target) pair.
   * Called by ModerationService.createReport.
   */
  async recordReport(opts: { reporterId: string; targetId: string }): Promise<void> {
    const today = this.todayKey();
    const key = `report-spam:${opts.reporterId}:${opts.targetId}:${today}`;
    try {
      const p = this.redis.multi();
      p.incr(key);
      p.expireat(key, this.nextMidnightEpoch());
      await p.exec();
    } catch (e) {
      this.logger.warn(`Report spam record failed: ${(e as Error).message}`);
    }
  }

  /**
   * Check if a socket has exceeded the WS message limit (30 msgs / 10s).
   * Returns true if the message should be rejected.
   */
  async isWsMessageLimited(socketId: string): Promise<{ limited: boolean; count: number }> {
    const windowId = Math.floor(Date.now() / 1000 / 10);
    const key = `ws-msg:${socketId}:${windowId}`;
    try {
      const [count] = await this.redis.multi().incr(key).expire(key, 10).exec() as unknown as [Error | null, number][];
      const c = count?.[1] ?? 0;
      return { limited: c > this.wsMsgLimit, count: c };
    } catch {
      return { limited: false, count: 0 };
    }
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
