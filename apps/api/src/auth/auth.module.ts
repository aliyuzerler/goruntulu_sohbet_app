import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FirebaseService } from './firebase.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { DevicesModule } from '../devices/devices.module';
import { BanEvasionModule } from '../ban-evasion/ban-evasion.module';
import { AdminModule } from '../admin/admin.module';
import { SecurityModule } from '../security/security.module';

/**
 * AuthModule — wires Firebase (or dev bypass), JWT issuance + refresh rotation,
 * admin login. Depends on DevicesModule (for attaching refresh tokens to
 * devices), BanEvasionModule (for ban evasion check on signup), and
 * SecurityModule (for rate limiting on auth endpoints).
 */
@Module({
  imports: [
    ConfigModule,
    DevicesModule,
    BanEvasionModule,
    AdminModule,
    SecurityModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET')!,
        signOptions: {
          expiresIn: config.get<number>('JWT_ACCESS_TTL') ?? 900,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, FirebaseService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
