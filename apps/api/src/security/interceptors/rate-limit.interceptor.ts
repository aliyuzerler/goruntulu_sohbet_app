import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import type { Request } from 'express';
import { RateLimitService } from '../rate-limit.service';
import { RateLimitOpts } from '../decorators/rate-limit.decorator';

/**
 * RateLimitInterceptor — reads the @RateLimit() metadata, increments the
 * Redis counter for IP + device, and 429s if the limit is exceeded.
 *
 * Phase 8 will add: sliding window, custom 429 body with retry-after header,
 * multi-tier (per-IP vs per-device vs per-user).
 */
@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimit: RateLimitService,
  ) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const opts = this.reflector.get<RateLimitOpts>('rate-limit', ctx.getHandler());
    if (!opts) {
      return next.handle();
    }
    const req = ctx.switchToHttp().getRequest<Request & { user?: { id?: string } }>();
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.ip ||
      '0.0.0.0';
    const userId = req.user?.id ?? 'anon';
    const compositeKey = `${opts.key}:ip:${ip}:u:${userId}`;

    const r = await this.rateLimit.hit({
      key: compositeKey,
      windowSec: opts.windowSec,
    });

    if (r.count > opts.limit) {
      throw new HttpException(
        {
          code: 'RATE_LIMITED',
          message: 'Too many requests',
          retryAfterSec: r.resetInSec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return next.handle();
  }
}
