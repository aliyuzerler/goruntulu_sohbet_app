import { Global, Module } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';
import { RateLimitInterceptor } from './interceptors/rate-limit.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';

/**
 * SecurityModule — provides rate limiting (IP + device) and brute-force
 * protection backed by Redis. Exposed globally so @RateLimit() decorator works
 * on any controller without importing SecurityModule explicitly.
 */
@Global()
@Module({
  providers: [
    RateLimitService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RateLimitInterceptor,
    },
  ],
  exports: [RateLimitService],
})
export class SecurityModule {}
