import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * DB indicator — runs SELECT 1 to verify Postgres is reachable & alive.
 * Latency measured manually since Terminus doesn't include it by default.
 */
@Injectable()
export class DbHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const latencyMs = Date.now() - start;
      return this.getStatus(key, true, { latencyMs });
    } catch (err) {
      const latencyMs = Date.now() - start;
      throw new HealthCheckError(
        `${key} check failed: ${(err as Error).message}`,
        this.getStatus(key, false, { latencyMs, error: (err as Error).message }),
      );
    }
  }
}
