import { randomUUID } from 'crypto';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiErrorDto } from '@randchat/shared';

/**
 * Global exception filter — wraps every thrown error into the shared
 * ApiErrorDto envelope so user_app/admin_app can localize messages by `code`.
 *
 * Trace IDs are propagated to the LoggingInterceptor via res.locals.traceId.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const traceId = randomUUID();
    res.locals.traceId = traceId;

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const code = isHttpException
      ? (exception.message || exception.name).toUpperCase().replace(/\s+/g, '_')
      : 'INTERNAL_ERROR';

    let message = 'Internal server error';
    let details: Record<string, unknown> | undefined;

    if (isHttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        message = response;
      } else if (response !== null && typeof response === 'object') {
        const r = response as Record<string, unknown>;
        message = (r.message as string | string[] | undefined)
          ? Array.isArray(r.message)
            ? r.message.join(', ')
            : (r.message as string)
          : exception.message;
        message = message || exception.message;
        details = r.error ? { error: r.error } : undefined;
      }
    } else if (exception instanceof Error) {
      // Don't leak raw error messages in production
      message = process.env.NODE_ENV === 'production' ? 'Internal server error' : exception.message;
    }

    const body: ApiErrorDto = {
      code,
      message,
      details,
      traceId,
    };

    if (status >= 500) {
      this.logger.error(
        `[${traceId}] ${req.method} ${req.path} ${status} — ${(exception as Error).stack ?? (exception as Error).message}`,
      );
    }

    res.status(status).json(body);
  }
}
