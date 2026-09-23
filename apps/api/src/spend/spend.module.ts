import { Module, Global } from '@nestjs/common';
import { SpendService } from './spend.service';
import { WalletModule } from '../wallet/wallet.module';

@Global()
@Module({
  imports: [WalletModule],
  providers: [SpendService],
  exports: [SpendService],
})
export class SpendModule {}
