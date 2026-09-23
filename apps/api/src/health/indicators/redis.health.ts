import { Injectable, Logger } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Redis indicator — uses a short-lived connection to run PING.
 *
 * Phase 1 uses an ephemeral client because we don't yet have a global
 * Redis client provider (added in Phase 3 alongside presence/matchmaking).
 * When the RedisModule lands, this should switch to injecting that client.
 */
@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(RedisHealthIndicator.name);
  private readonly url: string;

  constructor(config: ConfigService) {
    super();
    this.url = config.get<string>('REDIS_URL')!;
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const start = Date.now();
    const client = new Redis(this.url, {
      connectTimeout: 1000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    try {
      await client.connect();
      await client.ping();
      const latencyMs = Date.now() - start;
      return this.getStatus(key, true, { latencyMs });
    } catch (err) {
      const latencyMs = Date.now() - start;
      this.logger.warn(`Redis health check failed: ${(err as Error).message}`);
      throw new HealthCheckError(
        `${key} check failed`,
        this.getStatus(key, false, { latencyMs, error: (err as Error).message }),
      );
    } finally {
      client.disconnect();
    }
  }
}
