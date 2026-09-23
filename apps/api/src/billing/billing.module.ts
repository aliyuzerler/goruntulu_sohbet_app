import { Module, Global } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { GooglePlayService } from './google-play.service';
import { ProductsConfig } from './products.config';
import { SpendService } from './spend.service';
import { WalletModule } from '../wallet/wallet.module';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * BillingModule — Google Play IAP + RTDN refund + SpendService.
 * Global so matchmaking can inject SpendService without explicit import.
 */
@Global()
@Module({
  imports: [WalletModule, PrismaModule],
  controllers: [BillingController],
  providers: [BillingService, GooglePlayService, ProductsConfig, SpendService],
  exports: [BillingService, GooglePlayService, ProductsConfig, SpendService],
})
export class BillingModule {}
