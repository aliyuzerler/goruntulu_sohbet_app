import { Module, Global } from '@nestjs/common';
import { MatchmakingService } from './matchmaking.service';
import { DailyQuotaService } from './daily-quota.service';
import { WalletModule } from '../wallet/wallet.module';
import { BillingModule } from '../billing/billing.module';
import { VipModule } from '../vip/vip.module';
import { FiltersModule } from '../filters/filters.module';
import { CallsModule } from '../calls/calls.module';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [WalletModule, BillingModule, VipModule, FiltersModule, CallsModule, PrismaModule],
  providers: [MatchmakingService, DailyQuotaService],
  exports: [MatchmakingService, DailyQuotaService],
})
export class MatchmakingModule {}
