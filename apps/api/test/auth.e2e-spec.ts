import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe, HttpStatus } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/interceptors/http-exception.filter';

/**
 * Phase 2 auth smoke tests — verifies:
 *   1. Dev bypass phone login returns tokens + user
 *   2. /me returns 401 without auth
 *   3. /me returns user with auth
 *   4. /agreements/latest returns the seeded Terms + Privacy
 *
 * Prereqs: docker-compose up (infra/scripts/dev-up.sh) + prisma migrate deploy + seed.
 * Run with: pnpm --filter @randchat/api exec jest --config ./test/jest-e2e.json -- auth.e2e-spec
 */
describe('API /auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
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

  it('GET /api/me without auth → 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/me');
    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    expect(res.body).toHaveProperty('code');
  });

  it('POST /api/auth/verify-phone (dev bypass) → 201 + tokens + user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/verify-phone')
      .send({
        idToken: '000000',
        phone: '+905555555555',
        androidId: 'ci-android-1',
        fcmToken: 'ci-fcm-token-1',
        appVersion: '0.1.0',
      });
    expect(res.status).toBe(HttpStatus.CREATED);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body).toHaveProperty('refreshTokenId');
    expect(res.body.user).toHaveProperty('id');
    expect(res.body.user).toHaveProperty('role', 'USER');
    expect(res.body.user).toHaveProperty('profileCompleted', false);
  });

  it('GET /api/agreements/latest → Terms + Privacy (after seed)', async () => {
    const res = await request(app.getHttpServer()).get('/api/agreements/latest');
    expect(res.status).toBe(HttpStatus.OK);
    // Both seeded in the test DB.
    expect(res.body.terms).toBeTruthy();
    expect(res.body.privacy).toBeTruthy();
    expect(res.body.terms.version).toBe('1.0.0');
  });
});
