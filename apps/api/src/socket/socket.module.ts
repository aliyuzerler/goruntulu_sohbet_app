import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { CallsModule } from '../calls/calls.module';
import { MatchmakingModule } from '../matchmaking/matchmaking.module';
import { WalletModule } from '../wallet/wallet.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SocketGateway } from './socket.gateway';
import { SocketHandshakeAuth } from './services/socket-handshake-auth';
import { RedisAdapterService } from './services/redis-adapter.service';
import { PresenceService } from './services/presence.service';
import { LatencyService } from './services/latency.service';

/**
 * SocketModule — wires the WebSocket gateway with all its services.
 *
 * Phase 5: imports MatchmakingModule (Lua atomic match + country priority +
 * daily quota + wallet debit).
 */
@Global()
@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    AuthModule,
    CallsModule,
    WalletModule,
    MatchmakingModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET')!,
        signOptions: { expiresIn: config.get<number>('JWT_ACCESS_TTL') ?? 900 },
      }),
    }),
  ],
  providers: [
    SocketGateway,
    SocketHandshakeAuth,
    RedisAdapterService,
    PresenceService,
    LatencyService,
  ],
  exports: [
    RedisAdapterService,
    PresenceService,
    LatencyService,
    SocketHandshakeAuth,
  ],
})
export class SocketModule {}
