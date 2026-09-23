import { Module, Global } from '@nestjs/common';
import { VipController } from './vip.controller';
import { EntitlementService } from './entitlement.service';
import { BillingModule } from '../billing/billing.module';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * VipModule — VIP subscription entitlement.
 * Global so matchmaking + /me + filters can inject EntitlementService.
 */
@Global()
@Module({
  imports: [BillingModule, PrismaModule],
  controllers: [VipController],
  providers: [EntitlementService],
  exports: [EntitlementService],
})
export class VipModule {}
