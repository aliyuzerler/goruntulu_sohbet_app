import { Module, Global } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

/**
 * WalletModule — global so the MatchmakingService + CallsService can inject
 * WalletService without explicit import. Used by Phase 5 matchmaking for
 * per-match coin debit.
 */
@Global()
@Module({
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
