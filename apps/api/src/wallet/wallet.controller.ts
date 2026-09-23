import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

class TransactionListDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  take?: number;
}

/**
 * WalletController — endpoints for the user's wallet.
 * All routes require JWT auth.
 *
 *   GET /api/wallet             — current balance
 *   GET /api/wallet/transactions — paginated transaction history
 */
@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  async balance(@CurrentUser() user: { id: string }) {
    const balance = await this.wallet.getBalance(user.id);
    return { balance, currency: 'COIN' };
  }

  @Get('transactions')
  async transactions(
    @Query() dto: TransactionListDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.wallet.getTransactions({
      userId: user.id,
      take: dto.take ?? 20,
      cursor: dto.cursor,
    });
  }
}
