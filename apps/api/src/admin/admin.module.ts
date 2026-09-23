import { Module, Global } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { TotpService } from './totp.service';
import { WalletModule } from '../wallet/wallet.module';
import { ModerationModule } from '../moderation/moderation.module';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [WalletModule, ModerationModule, PrismaModule],
  controllers: [AdminController],
  providers: [AdminService, TotpService],
  exports: [AdminService, TotpService],
})
export class AdminModule {}
