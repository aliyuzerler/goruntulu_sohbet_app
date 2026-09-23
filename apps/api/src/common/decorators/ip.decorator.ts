import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * @Ip() — extracts the client's real IP from the request.
 * Handles X-Forwarded-For (when behind a proxy / load balancer).
 * Phase 8 will add trusted-proxy config so we don't blindly trust XFF.
 */
export const Ip = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length > 0) {
      return xff.split(',')[0].trim();
    }
    return req.ip ?? '0.0.0.0';
  },
);
