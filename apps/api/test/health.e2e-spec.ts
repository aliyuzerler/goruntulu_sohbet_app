import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe, HttpStatus } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import type { HealthResponseDto } from '@randchat/shared';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/interceptors/http-exception.filter';

/**
 * Phase 1 smoke tests — verifies:
 *   1. App boots with all required env vars
 *   2. GET /api/health returns 200 with HealthResponseDto shape
 *   3. Components include db, redis, storage
 *   4. Unknown route returns ApiErrorDto envelope (not raw NestJS error)
 *
 * Run with: pnpm --filter @randchat/api test:e2e
 *
 * Prereqs: docker-compose up (infra/scripts/dev-up.sh)
 */
describe('API /health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          // Skip schema validation in tests — env is already loaded by jest
          validationSchema: undefined,
        }),
        AppModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health → 200 + HealthResponseDto', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.status).toBe(HttpStatus.OK);

    const body = res.body as HealthResponseDto;
    expect(body.service).toBe('randchat-api');
    expect(body.version).toBe('0.1.0');
    expect(body.env).toBe('test');
    expect(typeof body.uptime).toBe('number');
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(body.components).toHaveProperty('db');
    expect(body.components).toHaveProperty('redis');
    expect(body.components).toHaveProperty('storage');
    // Each component must report a status string
    expect(['up', 'down', 'degraded']).toContain(body.components.db.status);
    expect(['up', 'down', 'degraded']).toContain(body.components.redis.status);
    expect(['up', 'down', 'degraded']).toContain(body.components.storage.status);
  });

  it('GET /api/unknown → 404 + ApiErrorDto envelope', async () => {
    const res = await request(app.getHttpServer()).get('/api/unknown');
    expect(res.status).toBe(HttpStatus.NOT_FOUND);
    expect(res.body).toHaveProperty('code');
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('traceId');
    expect(res.body.traceId).toMatch(/^[0-9a-f-]{36}$/i);
  });
});
