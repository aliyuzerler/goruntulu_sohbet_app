import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { SpendService } from '../billing/spend.service';
import { EntitlementService } from '../vip/entitlement.service';

/**
 * FiltersService — paid country filter (20 coins / 24h, or free for VIP).
 *
 * Gender filter is NOT a row in FilterActivation — it's gated purely by
 * EntitlementService.isActive(). Gender is a VIP-only feature.
 *
 * Country filter:
 *   - VIP user → free activation for 24h (isVipGrant=true, coinsSpent=0)
 *   - Non-VIP user → 20 coins for 24h (isVipGrant=false, coinsSpent=20)
 *
 * Lifecycle:
 *   1. activateCountryFilter({ userId, countryCode })
 *      - Check entitlement.isActive — VIP gets free activation.
 *      - Non-VIP → SpendService.spendFilter(20 coins, idempotencyKey=filter_<userId>_<timestamp>)
 *      - Upsert FilterActivation (userId, type='COUNTRY', value=countryCode, expiresAt=now+24h)
 *   2. getActiveCountryFilter(userId) — returns country code if active, else null.
 *      Used by matchmaking to apply the filter.
 *   3. Cron sweep: delete expired FilterActivation rows (TTL'd via expiresAt).
 *
 * Idempotency: FilterActivation(userId, type) is unique — re-activate replaces
 * the row with a new expiresAt.
 */
@Injectable()
export class FiltersService {
  private readonly logger = new Logger(FiltersService.name);
  private readonly countryFilterCost: number;
  private readonly countryFilterDurationHours: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly spend: SpendService,
    private readonly entitlement: EntitlementService,
    config: ConfigService,
  ) {
    this.countryFilterCost = config.get<number>('COIN_COST_COUNTRY_FILTER') ?? 20;
    this.countryFilterDurationHours =
      config.get<number>('COUNTRY_FILTER_DURATION_HOURS') ?? 24;
  }

  /**
   * Activate the country filter for the user.
   *   - VIP user → free (no coin charge)
   *   - Non-VIP → coin charge via SpendService
   *   - Insufficient balance → throws BadRequestException
   */
  async activateCountryFilter(opts: {
    userId: string;
    countryCode: string;
  }): Promise<{
    type: 'COUNTRY';
    value: string;
    expiresAt: Date;
    coinsSpent: number;
    isVipGrant: boolean;
    newBalance: number;
  }> {
    // Validate ISO 3166-1 alpha-2.
    if (!/^[A-Z]{2}$/.test(opts.countryCode)) {
      throw new BadRequestException('countryCode must be ISO 3166-1 alpha-2');
    }
    const isVip = await this.entitlement.isActive(opts.userId);
    const expiresAt = new Date(
      Date.now() + this.countryFilterDurationHours * 60 * 60 * 1000,
    );

    let coinsSpent = 0;
    let newBalance = 0;

    if (!isVip) {
      // Charge coins via SpendService (atomic + idempotent).
      const spend = await this.spend.spendFilter({
        userId: opts.userId,
        filterType: 'COUNTRY',
        amount: this.countryFilterCost,
        filterId: `country_${opts.countryCode}_${Date.now()}`,
      });
      coinsSpent = this.countryFilterCost;
      newBalance = spend.newBalance;
    } else {
      // VIP — free activation. Just fetch current balance for response.
      newBalance = await this.wallet.getBalance(opts.userId);
    }

    // Upsert FilterActivation row.
    const row = await this.prisma.filterActivation.upsert({
      where: {
        userId_type: { userId: opts.userId, type: 'COUNTRY' },
      },
      create: {
        userId: opts.userId,
        type: 'COUNTRY',
        value: opts.countryCode,
        expiresAt,
        coinsSpent,
        isVipGrant: isVip,
      },
      update: {
        value: opts.countryCode,
        expiresAt,
        coinsSpent,
        isVipGrant: isVip,
      },
    });

    this.logger.log(
      `✓ Country filter ${opts.countryCode} activated for user ${opts.userId} until ${expiresAt.toISOString()} (${isVip ? 'VIP' : `${coinsSpent} coins`})`,
    );

    return {
      type: 'COUNTRY',
      value: row.value,
      expiresAt: row.expiresAt,
      coinsSpent: row.coinsSpent,
      isVipGrant: row.isVipGrant,
      newBalance,
    };
  }

  /** Get the user's active country filter, or null if expired/missing. */
  async getActiveCountryFilter(userId: string): Promise<string | null> {
    const now = new Date();
    const row = await this.prisma.filterActivation.findUnique({
      where: { userId_type: { userId, type: 'COUNTRY' } },
    });
    if (!row) return null;
    if (row.expiresAt.getTime() < now.getTime()) return null;
    return row.value;
  }

  /** All active filters for a user (used by /me + matchmaking). */
  async getActiveFilters(userId: string): Promise<{
    country: string | null;
    genderAllowed: boolean; // VIP-only — true if Entitlement.isActive
    vip: { isActive: boolean; expiresAt: Date | null };
  }> {
    const [country, vip] = await Promise.all([
      this.getActiveCountryFilter(userId),
      this.entitlement.getEntitlement(userId),
    ]);
    return {
      country,
      genderAllowed: vip.isActive,
      vip,
    };
  }

  /** Cron sweep: delete expired FilterActivation rows. */
  async purgeExpiredFilters(): Promise<number> {
    const now = new Date();
    const result = await this.prisma.filterActivation.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    if (result.count > 0) {
      this.logger.log(`✓ Purged ${result.count} expired filter activations`);
    }
    return result.count;
  }
}
