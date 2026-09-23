import { SetMetadata } from '@nestjs/common';

export interface RateLimitOpts {
  /** Stable key — same key groups requests into one counter. */
  key: string;
  /** Max requests per window. */
  limit: number;
  /** Window in seconds. */
  windowSec: number;
}

/**
 * @RateLimit({ key: 'verify-phone', limit: 5, windowSec: 600 })
 * Combined with the global RateLimitInterceptor — interceptor reads this
 * metadata and 429s if the IP+device counter exceeds the limit.
 */
export const RateLimit = (opts: RateLimitOpts) => SetMetadata('rate-limit', opts);
