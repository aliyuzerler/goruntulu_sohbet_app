import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe, HttpStatus } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/interceptors/http-exception.filter';
import { RedisAdapterService } from '../src/socket/services/redis-adapter.service';

/**
 * IAP idempotency e2e test — verifies:
 *   1. First verify-purchase → coins credited.
 *   2. Same purchaseToken twice → alreadyProcessed=true, no double credit.
 *   3. Balance after replay == balance after first call.
 *
 * Prereqs: docker-compose up + prisma migrate + seed.
 * Run: pnpm --filter @randchat/api exec jest --config ./test/jest-e2e.json -- iap-idempotency.e2e-spec
 */
describe('IAP idempotency (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let balanceAfterFirst: number;
  const testPurchaseToken = 'iap_idempotency_test_token_001';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, validationSchema: undefined }), AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.setGlobalPrefix('api');
    await app.get(RedisAdapterService).connect();
    await app.init();
    await app.listen(0);

    // Login via dev bypass.
    const res = await request(app.getHttpServer())
      .post('/api/auth/verify-phone')
      .send({ idToken: '000000', phone: '+905555555599' });
    token = res.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('first verify-purchase → 201 + coins credited', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/billing/verify-purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: 'coin_pack_small', purchaseToken: testPurchaseToken });
    expect(res.status).toBe(HttpStatus.CREATED);
    expect(res.body.coinsCredited).toBe(10);
    expect(res.body.status).toBe('VERIFIED');
    expect(res.body.alreadyProcessed).toBe(false);
    balanceAfterFirst = res.body.newBalance;
  });

  it('same purchaseToken again → alreadyProcessed=true, balance unchanged', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/billing/verify-purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: 'coin_pack_small', purchaseToken: testPurchaseToken });
    expect(res.status).toBe(HttpStatus.CREATED);
    expect(res.body.alreadyProcessed).toBe(true);
    expect(res.body.newBalance).toBe(balanceAfterFirst);
  });

  it('wallet balance matches after replay', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/wallet')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.balance).toBe(balanceAfterFirst);
  });
});
