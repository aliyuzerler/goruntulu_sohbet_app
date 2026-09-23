import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { INestApplication } from '@nestjs/common';
import type { ServerOptions, Server } from 'socket.io';

/**
 * RedisAdapterService — bootstraps the @socket.io/redis-adapter so Socket.IO
 * broadcasts work across multiple API instances (horizontal scaling).
 *
 * Usage:
 *   const app = await NestFactory.create(AppModule);
 *   const svc = app.get(RedisAdapterService);
 *   await svc.connect();          // eagerly connect pub + sub clients
 *   app.useWebSocketAdapter(new RedisIoAdapter(app, svc));
 *
 * Connect is called from main.ts after the app is created but before
 * app.listen(). This way the WebSocket adapter has the redis clients ready
 * when NestJS boots the socket.io server.
 */
@Injectable()
export class RedisAdapterService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisAdapterService.name);
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;
  private connected = false;

  constructor(private readonly config: ConfigService) {}

  /** Eagerly connect pub + sub Redis clients. Idempotent. */
  async connect(): Promise<void> {
    if (this.connected) return;
    const url = this.config.get<string>('REDIS_URL');
    if (!url) return;
    try {
      this.pubClient = new Redis(url, { connectTimeout: 1000, maxRetriesPerRequest: 1 });
      this.subClient = new Redis(url, { connectTimeout: 1000, maxRetriesPerRequest: 1 });
      await Promise.all([this.pubClient.connect(), this.subClient.connect()]);
      this.connected = true;
      this.logger.log('✓ Redis adapter clients connected');
    } catch (e) {
      this.logger.warn(
        `Redis adapter connect failed: ${(e as Error).message} — using in-memory adapter (single-instance only)`,
      );
      await this.pubClient?.quit().catch(() => {});
      await this.subClient?.quit().catch(() => {});
      this.pubClient = null;
      this.subClient = null;
      this.connected = false;
    }
  }

  /** Build the adapter function — null if not connected. Synchronous. */
  getAdapterFn(): ReturnType<typeof createAdapter> | null {
    if (!this.connected || !this.pubClient || !this.subClient) return null;
    return createAdapter(this.pubClient, this.subClient, {
      key: this.config.get<string>('SOCKET_IO_ADAPTER_CHANNEL_PREFIX') ?? 'socket.io',
    });
  }

  async onModuleDestroy() {
    await this.pubClient?.quit().catch(() => {});
    await this.subClient?.quit().catch(() => {});
    this.logger.log('Redis adapter clients closed');
  }
}

/**
 * NestJS IoAdapter that wires the Redis adapter into the socket.io server.
 * Use in main.ts: `app.useWebSocketAdapter(new RedisIoAdapter(app, svc));`
 *
 * createIOServer is synchronous — the adapter is already pre-created by
 * RedisAdapterService.connect() called from main.ts.
 */
export class RedisIoAdapter extends IoAdapter {
  constructor(
    app: INestApplication,
    private readonly adapterService: RedisAdapterService,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    // Super creates the socket.io server with our options.
    const server = super.createIOServer(port, options) as Server;
    const adapterFn = this.adapterService.getAdapterFn();
    if (adapterFn) {
      server.adapter(adapterFn);
    }
    return server;
  }
}
