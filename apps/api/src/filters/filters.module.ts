import { Module, Global } from '@nestjs/common';
import { FiltersController } from './filters.controller';
import { FiltersService } from './filters.service';
import { WalletModule } from '../wallet/wallet.module';
import { BillingModule } from '../billing/billing.module';
import { VipModule } from '../vip/vip.module';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * FiltersModule — Phase 7 country filter (paid or VIP-grant).
 * Global so matchmaking can inject FiltersService.
 */
@Global()
@Module({
  imports: [WalletModule, BillingModule, VipModule, PrismaModule],
  controllers: [FiltersController],
  providers: [FiltersService],
  exports: [FiltersService],
})
export class FiltersModule {}
