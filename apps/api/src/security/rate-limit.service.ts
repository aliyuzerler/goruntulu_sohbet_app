import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * RateLimitService — Redis-backed fixed-window counter for IP and device keys.
 *
 *   Key layout: rl:{routeKey}:{ip|device}:{windowId}
 *   - routeKey: e.g. "verify-phone" (set by the @RateLimit decorator)
 *   - windowId: floor(now / windowSec) — so counter resets every windowSec
 *
 * Atomic INCR + EXPIRE in pipeline so two concurrent requests can't double-spend.
 *
 * Phase 8 may add: token bucket for smoother traffic, distributed Lua script
 * for true atomicity across replicas.
 */
@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private redis: Redis | null = null;
  private readonly redisUrl: string;

  constructor(config: ConfigService) {
    this.redisUrl = config.get<string>('REDIS_URL')!;
    // Lazy connect — first use. If Redis is down, we fail OPEN (allow the
    // request) rather than blocking the whole API. Logged at warn level.
  }

  private async getClient(): Promise<Redis> {
    if (this.redis) return this.redis;
    this.redis = new Redis(this.redisUrl, {
      connectTimeout: 1000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    try {
      await this.redis.connect();
    } catch (err) {
      this.redis = null;
      throw err;
    }
    return this.redis!;
  }

  /**
   * Increment counter for the key, return the new count.
   * Caller checks the count against `limit` and 429s if exceeded.
   */
  async hit(opts: { key: string; windowSec: number }): Promise<{ count: number; resetInSec: number }> {
    const windowId = Math.floor(Date.now() / 1000 / opts.windowSec);
    const key = `rl:${opts.key}:${windowId}`;
    try {
      const client = await this.getClient();
      const results = await client
        .multi()
        .incr(key)
        .expire(key, opts.windowSec)
        .exec();
      if (!results || results.length < 2) {
        // Should never happen — Redis is broken.
        return { count: 0, resetInSec: opts.windowSec };
      }
      // exec returns [err, result][] in pipeline mode — both items should be non-error.
      const [incrErr, count] = results[0] as [Error | null, unknown];
      const [expireErr, ttl] = results[1] as [Error | null, unknown];
      if (incrErr || typeof count !== 'number') {
        return { count: 0, resetInSec: opts.windowSec };
      }
      return {
        count,
        resetInSec: typeof ttl === 'number' ? Math.max(ttl, 1) : opts.windowSec,
      };
      void expireErr;
    } catch (err) {
      // Fail open — log and allow.
      this.logger.warn(`Rate-limit Redis failed: ${(err as Error).message} — allowing request`);
      return { count: 0, resetInSec: opts.windowSec };
    }
  }

  /** Brute-force check — returns true if IP is currently locked out. */
  async isLockedOut(key: string): Promise<boolean> {
    try {
      const client = await this.getClient();
      const v = await client.get(`bf:${key}`);
      return v !== null;
    } catch {
      return false;
    }
  }

  /** Lock out for X seconds. */
  async lockOut(key: string, sec: number): Promise<void> {
    try {
      const client = await this.getClient();
      await client.set(`bf:${key}`, '1', 'EX', sec);
    } catch (err) {
      this.logger.warn(`Lockout set failed: ${(err as Error).message}`);
    }
  }
}
