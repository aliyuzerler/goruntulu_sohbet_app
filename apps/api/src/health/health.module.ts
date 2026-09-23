import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { DbHealthIndicator } from './indicators/db.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { StorageHealthIndicator } from './indicators/storage.health';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [DbHealthIndicator, RedisHealthIndicator, StorageHealthIndicator],
})
export class HealthModule {}
