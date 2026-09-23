import { Module, Global } from '@nestjs/common';
import { RetentionController } from './retention.controller';
import { RetentionService } from './retention.service';
import { WalletModule } from '../wallet/wallet.module';
import { BillingModule } from '../billing/billing.module';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [WalletModule, BillingModule, PrismaModule],
  controllers: [RetentionController],
  providers: [RetentionService],
  exports: [RetentionService],
})
export class RetentionModule {}
