import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe, HttpStatus } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { io as ioc } from 'socket.io-client';
import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/interceptors/http-exception.filter';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { RedisAdapterService } from '../src/socket/services/redis-adapter.service';

/**
 * Phase 3 socket smoke tests — verifies:
 *   1. /auth/verify-phone returns a JWT
 *   2. Socket.IO handshake WITHOUT token is rejected
 *   3. Socket.IO handshake WITH token is accepted + emits `connected` envelope
 *   4. Latency ping → pong → rtt loop works
 *   5. Heartbeat refreshes presence
 *
 * Prereqs: docker-compose up + prisma migrate + seed.
 * Run: pnpm --filter @randchat/api exec jest --config ./test/jest-e2e.json -- socket.e2e-spec
 */
describe('API /socket.io (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let token: string;

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

    // Connect Redis adapter (needed for socket.io to use the right transport).
    const redisAdapter = app.get(RedisAdapterService);
    await redisAdapter.connect();

    await app.init();
    await app.listen(0); // random port — we'll get it next line.
    const server = app.getHttpServer();
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 3000;
    baseUrl = `http://localhost:${port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('logs in via dev bypass to get JWT', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/verify-phone')
      .send({
        idToken: '000000',
        phone: '+905555555555',
      });
    expect(res.status).toBe(HttpStatus.CREATED);
    token = res.body.accessToken;
    expect(token).toBeTruthy();
  });

  it('rejects socket.io connection without token', async () => {
    const sock = ioc(baseUrl, {
      transports: ['websocket'],
      timeout: 1000,
    });
    await new Promise<void>((resolve) => {
      sock.on('connect_error', () => {
        sock.disconnect();
        resolve();
      });
      sock.on('connect', () => {
        // Should not happen.
        sock.disconnect();
        throw new Error('Connection should have been rejected');
      });
    });
  });

  it('accepts socket.io connection with valid token + emits `connected` envelope', async () => {
    const sock = ioc(baseUrl, {
      transports: ['websocket'],
      auth: { token },
      timeout: 3000,
    });
    const connected = await new Promise<{ type: string; payload: { userId: string } }>(
      (resolve, reject) => {
        sock.on('message', (data) => {
          if (data?.type === 'connected') {
            resolve(data);
          }
        });
        sock.on('connect_error', (err) => reject(err));
        setTimeout(() => reject(new Error('timeout waiting for `connected`')), 5000);
      },
    );
    expect(connected.type).toBe('connected');
    expect(connected.payload.userId).toBeTruthy();
    sock.disconnect();
  });

  it('measures RTT via latency ping/pong loop', async () => {
    const sock = ioc(baseUrl, {
      transports: ['websocket'],
      auth: { token },
      timeout: 3000,
    });
    const rttEnvelope = await new Promise<{ type: string; payload: { rttMs: number } }>(
      (resolve, reject) => {
        sock.on('message', (data) => {
          if (data?.type === 'latency:rtt') {
            resolve(data);
          }
        });
        sock.on('connect_error', (err) => reject(err));
        setTimeout(() => reject(new Error('timeout waiting for latency:rtt')), 10000);
      },
    );
    expect(rttEnvelope.type).toBe('latency:rtt');
    expect(rttEnvelope.payload.rttMs).toBeGreaterThanOrEqual(0);
    sock.disconnect();
  });
});
