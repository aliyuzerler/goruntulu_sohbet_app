import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/interceptors/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { RedisAdapterService, RedisIoAdapter } from './socket/services/redis-adapter.service';

/**
 * Bootstrap — entrypoint of the RandChat API.
 * Order of middleware matters:
 *   1. helmet + CORS (transport security)
 *   2. validation pipe (input integrity)
 *   3. exception filter (response envelope)
 *   4. logging interceptor (observability)
 *   5. Redis adapter for Socket.IO (horizontal scaling)
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true, // Needed for Stripe/Google Play webhook signature verification (Phase 6)
  });

  const config = app.get(ConfigService);
  const port = Number(config.get<number>('PORT') ?? 3000);
  const env = config.get<string>('NODE_ENV') ?? 'development';
  const corsOrigins = (config.get<string>('CORS_ORIGINS') ?? '').split(',').filter(Boolean);

  app.use(helmet());
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Prefix all REST routes with /api; Socket.IO stays at root for handshake.
  app.setGlobalPrefix('api');

  // Connect Redis adapter clients BEFORE binding the WebSocket adapter.
  // The adapter uses them synchronously inside createIOServer.
  const redisAdapter = app.get(RedisAdapterService);
  await redisAdapter.connect();
  app.useWebSocketAdapter(new RedisIoAdapter(app, redisAdapter));

  await app.listen(port);
  Logger.log(`🚀 RandChat API listening on :${port} [${env}]`, 'Bootstrap');
}

void bootstrap();
