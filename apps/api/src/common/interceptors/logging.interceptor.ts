import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';

/**
 * LoggingInterceptor — logs every HTTP request with method, path, latency, status.
 * Paired with the global exception filter to capture error trace IDs.
 *
 * Phase 7 will replace this with Sentry + pino structured logging; for now
 * it's enough to have a single place where all request logs go.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const { method, path } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const latencyMs = Date.now() - start;
          this.logger.log(`${method} ${path} ${res.statusCode} ${latencyMs}ms`);
        },
        error: (err) => {
          const latencyMs = Date.now() - start;
          this.logger.error(`${method} ${path} ERROR ${latencyMs}ms — ${(err as Error).message}`);
        },
      }),
    );
  }
}
