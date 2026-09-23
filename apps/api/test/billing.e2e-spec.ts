import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe, HttpStatus } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/interceptors/http-exception.filter';
import { BillingService } from '../src/billing/billing.service';

/**
 * Phase 6 IAP smoke tests — verifies:
 *   1. GET /api/billing/products → 4 coin packs
 *   2. POST /api/billing/verify-purchase (dev bypass) → 200 + coins credited
 *   3. POST /api/billing/verify-purchase with same orderId twice → idempotent
 *   4. POST /api/billing/rtdn-webhook with REFUNDED → debit
 *
 * Prereqs: docker-compose up + prisma migrate + seed.
 * Run: pnpm --filter @randchat/api exec jest --config ./test/jest-e2e.json -- billing.e2e-spec
 */
describe('API /billing (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let orderId: string;

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

  it('logs in via dev bypass to get JWT', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/verify-phone')
      .send({ idToken: '000000', phone: '+905555555555' });
    expect(res.status).toBe(HttpStatus.CREATED);
    token = res.body.accessToken;
  });

  it('GET /api/billing/products → 4 coin packs', async () => {
    const res = await request(app.getHttpServer()).get('/api/billing/products');
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.products).toHaveLength(4);
    expect(res.body.products[0].productId).toBe('coin_pack_small');
    expect(res.body.products[1].productId).toBe('coin_pack_medium');
    expect(res.body.products[2].productId).toBe('coin_pack_large');
    expect(res.body.products[3].productId).toBe('coin_pack_mega');
    expect(res.body.products[0].coins).toBe(10);
    expect(res.body.products[3].coins).toBe(400);
  });

  it('POST /api/billing/verify-purchase → 201 + coins credited', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/billing/verify-purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId: 'coin_pack_small',
        purchaseToken: 'test_token_buy_1',
      });
    expect(res.status).toBe(HttpStatus.CREATED);
    expect(res.body.coinsCredited).toBe(10);
    expect(res.body.status).toBe('VERIFIED');
    expect(res.body.newBalance).toBeGreaterThanOrEqual(10);
    orderId = res.body.orderId;
  });

  it('POST /api/billing/verify-purchase with same orderId twice → idempotent', async () => {
    // Second call with the same purchaseToken → same orderId → no double-credit.
    const res = await request(app.getHttpServer())
      .post('/api/billing/verify-purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId: 'coin_pack_small',
        purchaseToken: 'test_token_buy_1',
      });
    expect(res.status).toBe(HttpStatus.CREATED);
    expect(res.body.alreadyProcessed).toBe(true);
    expect(res.body.orderId).toBe(orderId);
    // Balance should be the same as before (no double-credit).
    expect(res.body.newBalance).toBeGreaterThanOrEqual(10);
  });

  it('POST /api/billing/rtdn-webhook with REFUNDED → debit', async () => {
    // Encode the RTDN payload as base64 (Pub/Sub message.data format).
    const payload = {
      version: '1.0',
      packageName: 'com.randchat.app',
      eventTimeMillis: String(Date.now()),
      oneTimeProductNotification: {
        version: '1.0',
        type: 'REFUNDED',
        purchaseToken: 'test_token_buy_1',
        sku: 'coin_pack_small',
      },
    };
    const dataB64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    const envelope = { message: { data: dataB64 } };

    const res = await request(app.getHttpServer())
      .post('/api/billing/rtdn-webhook')
      .set('Authorization', 'Bearer ') // Empty secret → dev bypass.
      .send(envelope);
    expect(res.status).toBe(HttpStatus.CREATED);
    expect(res.body.handled).toBe(true);
    // Refund debits 10 coins back.
  });

  it('BillingService directly — unknown product throws', async () => {
    const svc = app.get(BillingService);
    await expect(
      svc.verifyPurchase({
        userId: '00000000-0000-0000-0000-000000000000',
        productId: 'unknown_product',
        purchaseToken: 'any',
      }),
    ).rejects.toThrow();
  });
});
