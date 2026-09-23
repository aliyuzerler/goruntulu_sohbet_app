import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * RemoteConfigService — Redis-backed remote configuration.
 *
 * Used for:
 *   - min_app_version → forced update gate
 *   - global_matching_off → emergency kill switch (all queue:join rejected)
 *   - nsfw_threshold → emergency Rekognition threshold override
 *   - daily_free_quota → adjust free quota without redeploy
 *   - coin_cost_per_match → adjust economy without redeploy
 *   - skip_timeout_sec → emergency skip cooldown extension
 *
 * Layout (Redis):
 *   remote-config:<key>  = string value (numbers parsed by caller)
 *
 * All keys have defaults that match the env-backed config — admins can override
 * via Redis SET without restarting the API. Phase 10 will add an admin UI for this.
 *
 * Public endpoint GET /api/remote-config returns the public subset
 * (min_app_version, global_matching_off, daily_free_quota, coin_cost_per_match)
 * so the client can use the latest values without an extra fetch.
 */
@Injectable()
export class RemoteConfigService {
  private readonly logger = new Logger(RemoteConfigService.name);
  private readonly redis: Redis;
  private readonly defaults: Record<string, string>;

  constructor(config: ConfigService) {
    this.defaults = {
      'min_app_version': config.get<string>('MIN_APP_VERSION') ?? '0.0.0',
      'global_matching_off': 'false',
      'nsfw_threshold': String(config.get<number>('REKOGNITION_MIN_CONFIDENCE') ?? 60),
      'daily_free_quota': String(config.get<number>('DAILY_FREE_MATCH_QUOTA') ?? 10),
      'coin_cost_per_match': String(config.get<number>('COIN_COST_PER_MATCH') ?? 2),
      'skip_timeout_sec': String(config.get<number>('SKIP_TIMEOUT_SEC') ?? 30),
    };
    this.redis = new Redis(config.get<string>('REDIS_URL')!, {
      connectTimeout: 1000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    this.redis.connect().catch((e) => {
      this.logger.warn(`Redis connect failed (remote-config): ${e.message}`);
    });
  }

  /**
   * Get a single config value. Falls back to default if Redis is down or key missing.
   */
  async get(key: string): Promise<string> {
    try {
      const v = await this.redis.get(`remote-config:${key}`);
      return v ?? this.defaults[key] ?? '';
    } catch {
      return this.defaults[key] ?? '';
    }
  }

  async getNumber(key: string): Promise<number> {
    return parseInt(await this.get(key), 10) || 0;
  }

  async getBool(key: string): Promise<boolean> {
    return (await this.get(key)) === 'true';
  }

  /**
   * Get the public config subset — returned by GET /api/remote-config.
   * Used by the client on app boot (forced update gate + global matching flag).
   */
  async getPublicConfig(): Promise<{
    minAppVersion: string;
    globalMatchingOff: boolean;
    dailyFreeQuota: number;
    coinCostPerMatch: number;
  }> {
    return {
      minAppVersion: await this.get('min_app_version'),
      globalMatchingOff: await this.getBool('global_matching_off'),
      dailyFreeQuota: await this.getNumber('daily_free_quota'),
      coinCostPerMatch: await this.getNumber('coin_cost_per_match'),
    };
  }

  /**
   * Set a config value (admin action). TTL'd to 24h so if Redis is wiped,
   * we fall back to defaults.
   */
  async set(key: string, value: string): Promise<void> {
    try {
      await this.redis.set(`remote-config:${key}`, value, 'EX', 86400);
      this.logger.log(`✓ Remote config ${key} = ${value}`);
    } catch (e) {
      this.logger.warn(`Remote config set failed: ${(e as Error).message}`);
    }
  }

  /**
   * Emergency: turn off global matching. Used during incident response.
   * Setting via Redis means every API instance sees it within seconds.
   */
  async emergencyStopMatching(reason: string): Promise<void> {
    await this.set('global_matching_off', 'true');
    this.logger.warn(`🚨 EMERGENCY: global matching OFF — reason: ${reason}`);
  }

  async emergencyResumeMatching(): Promise<void> {
    await this.set('global_matching_off', 'false');
    this.logger.log('✓ EMERGENCY RESOLVED: global matching resumed');
  }
}
