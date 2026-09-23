import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthCheck, HealthCheckService, HealthCheckResult } from '@nestjs/terminus';
import type { HealthResponseDto, ComponentHealth } from '@randchat/shared';
import { DbHealthIndicator } from './indicators/db.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { StorageHealthIndicator } from './indicators/storage.health';

/**
 * GET /api/health
 *
 * Response shape is the shared HealthResponseDto — both user_app and admin_app
 * use this to validate that the API and all its critical infra dependencies
 * are reachable before allowing the user past the splash screen.
 */
@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(
    private readonly health: HealthCheckService,
    private readonly db: DbHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly storage: StorageHealthIndicator,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @HealthCheck()
  async check(): Promise<HealthResponseDto> {
    const result: HealthCheckResult = await this.health.check([
      () => this.db.isHealthy('db'),
      () => this.redis.isHealthy('redis'),
      () => this.storage.isHealthy('storage'),
    ]);

    // Terminus returns { status, info, error, details } where info/details
    // are keyed by the indicator key ("db", "redis", "storage").
    const mapToComponent = (key: string): ComponentHealth => {
      const info = (result.info as Record<string, unknown> | undefined)?.[key];
      const error = (result.error as Record<string, unknown> | undefined)?.[key];
      const isUp = result.status === 'ok';

      if (error && !isUp) {
        return {
          status: 'down',
          message: typeof error === 'object' && error ? String((error as Record<string, unknown>).message ?? error) : String(error),
        };
      }
      if (info && typeof info === 'object') {
        const i = info as Record<string, unknown>;
        return {
          status: 'up',
          latencyMs: typeof i.latencyMs === 'number' ? i.latencyMs : undefined,
        };
      }
      // Fallback — Terminus didn't include this key in info/error.
      return { status: isUp ? 'up' : 'down' };
    };

    return {
      uptime: Math.floor((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
      service: this.config.get<string>('SERVICE_NAME') ?? 'randchat-api',
      version: this.config.get<string>('SERVICE_VERSION') ?? '0.1.0',
      env: this.config.get<string>('NODE_ENV') ?? 'development',
      components: {
        db: mapToComponent('db'),
        redis: mapToComponent('redis'),
        storage: mapToComponent('storage'),
      },
    };
  }
}
