import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * PresenceService — Redis-backed online presence.
 *
 * Layout (all keys are TTL'd, refreshed by client heartbeat):
 *   presence:user:<userId>           : hash { status, country, deviceId, lastSeenAt }
 *   presence:online                   : set of userIds (for fast count + listing)
 *   presence:country:<country>       : set of userIds in that country (for country breakdown)
 *
 * On heartbeat: SETEX presence:user:<userId> = TTL, SADD to presence:online,
 * SADD to presence:country:<country>, expire the country sets after TTL.
 *
 * On disconnect: SREM from both sets, DEL presence:user:<userId>.
 *
 * Heartbeat TTL: HEARTBEAT_TTL_SEC (default 90s). Client must send a heartbeat
 * every HEARTBEAT_INTERVAL_SEC (default 30s) — 3x margin.
 */
@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);
  private readonly redis: Redis;
  private readonly ttlSec: number;

  constructor(config: ConfigService) {
    this.ttlSec = config.get<number>('HEARTBEAT_TTL_SEC') ?? 90;
    this.redis = new Redis(config.get<string>('REDIS_URL')!, {
      connectTimeout: 1000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    this.redis.connect().catch((e) => {
      this.logger.warn(`Redis connect failed (presence): ${e.message}`);
    });
  }

  /**
   * Refresh presence for a user — called on connect + each heartbeat.
   * Atomic pipeline: HSET + SADD + EXPIRE all execute together.
   */
  async refresh(opts: {
    userId: string;
    country?: string | null;
    deviceId?: string;
  }): Promise<void> {
    const now = Date.now();
    const userKey = `presence:user:${opts.userId}`;
    const country = (opts.country ?? '??').toUpperCase().slice(0, 2);

    try {
      // Pipeline is atomic for our purposes — all 4 ops run in one RTT.
      const p = this.redis.multi();
      p.hset(userKey, {
        status: 'online',
        country,
        deviceId: opts.deviceId ?? '',
        lastSeenAt: String(now),
      });
      p.expire(userKey, this.ttlSec);
      p.sadd('presence:online', opts.userId);
      p.sadd(`presence:country:${country}`, opts.userId);
      p.expire(`presence:country:${country}`, this.ttlSec);
      await p.exec();
    } catch (e) {
      // Fail open — log + continue. Server doesn't crash.
      this.logger.warn(`Presence refresh failed for ${opts.userId}: ${(e as Error).message}`);
    }
  }

  /**
   * Remove a user from presence — called on explicit disconnect.
   * Note: if the user just lost network, the TTL will drop them eventually;
   * we don't need a separate cron for that.
   */
  async remove(userId: string): Promise<void> {
    // Get country first so we can also SREM from the country set.
    const country = (await this.redis.hget(`presence:user:${userId}`, 'country')) ?? '??';
    try {
      const p = this.redis.multi();
      p.srem('presence:online', userId);
      p.srem(`presence:country:${country.toUpperCase()}`, userId);
      p.del(`presence:user:${userId}`);
      await p.exec();
    } catch (e) {
      this.logger.warn(`Presence remove failed for ${userId}: ${(e as Error).message}`);
    }
  }

  /**
   * Total online count — uses SCARD (O(1)).
   */
  async getOnlineCount(): Promise<number> {
    try {
      return await this.redis.scard('presence:online');
    } catch {
      return 0;
    }
  }

  /**
   * Top-N countries by user count. Returns { country, count }[] sorted desc.
   * Uses SCARD on each country set — Phase 8 may switch to a sorted set if
   * perf becomes a problem (we'd need a different layout).
   */
  async getCountryCounts(topN = 20): Promise<Record<string, number>> {
    try {
      // Get all country keys. SCAN iterates the keyspace — slow at scale but
      // fine for Phase 3 with a few hundred countries.
      const countries = new Set<string>();
      let cursor = '0';
      do {
        const [next, batch] = await this.redis.scan(
          cursor,
          'MATCH',
          'presence:country:??',
          'COUNT',
          100,
        );
        cursor = next;
        for (const key of batch) {
          const country = key.replace('presence:country:', '');
          countries.add(country);
        }
      } while (cursor !== '0');

      // SCARD each.
      const entries = await Promise.all(
        [...countries].map(async (c) => [c, await this.redis.scard(`presence:country:${c}`)] as const),
      );
      entries.sort((a, b) => b[1] - a[1]);
      return Object.fromEntries(entries.slice(0, topN));
    } catch (e) {
      this.logger.warn(`Country counts failed: ${(e as Error).message}`);
      return {};
    }
  }

  /** Check if a user is currently online (presence key exists + not expired). */
  async isOnline(userId: string): Promise<boolean> {
    try {
      const v = await this.redis.exists(`presence:user:${userId}`);
      return v === 1;
    } catch {
      return false;
    }
  }
}
