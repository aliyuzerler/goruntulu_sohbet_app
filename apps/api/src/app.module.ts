import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { APP_FILTER } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { StorageModule } from './storage/storage.module';
import { AgreementsModule } from './agreements/agreements.module';
import { DevicesModule } from './devices/devices.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WalletModule } from './wallet/wallet.module';
import { BillingModule } from './billing/billing.module';
import { VipModule } from './vip/vip.module';
import { FiltersModule } from './filters/filters.module';
import { ModerationModule } from './moderation/moderation.module';
import { AdminModule } from './admin/admin.module';
import { PlayIntegrityModule } from './play-integrity/play-integrity.module';
import { BanEvasionModule } from './ban-evasion/ban-evasion.module';
import { RateLimitExtensionsModule } from './rate-limits/rate-limits.module';
import { GdprModule } from './gdpr/gdpr.module';
import { RetentionModule } from './retention/retention.module';
import { RemoteConfigModule } from './remote-config/remote-config.module';
import { SecurityModule } from './security/security.module';
import { SocketModule } from './socket/socket.module';
import { CallsModule } from './calls/calls.module';
import { envValidationSchema } from './config/env.validation';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HttpExceptionFilter } from './common/interceptors/http-exception.filter';
import { JwtStrategy } from './auth/strategies/jwt.strategy';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
      expandVariables: true,
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    PrismaModule,
    SecurityModule,
    StorageModule,
    AgreementsModule,
    DevicesModule,
    AuthModule,
    UsersModule,
    WalletModule,
    BillingModule,
    VipModule,
    FiltersModule,
    ModerationModule,
    AdminModule,
    PlayIntegrityModule,
    BanEvasionModule,
    RateLimitExtensionsModule,
    GdprModule,
    RetentionModule,
    RemoteConfigModule,
    SocketModule,
    CallsModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    JwtStrategy,
  ],
})
export class AppModule {}
