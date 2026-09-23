import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * ProductsConfig — Phase 6 coin pack definitions.
 *
 * The product IDs MUST match the SKUs configured in the Google Play Console
 * (In-app products → Product IDs). Changing a product ID is a Play Console
 * operation — never change it from code without coordinating with Play.
 *
 * Coins-per-pack are server-authoritative; the client just shows the price +
 * the coin count and lets the user tap buy. The actual credit happens on
 * the server after Google Play verifies the purchase token.
 *
 * Phase 6 default tiers:
 *   coin_pack_small  →  10 coins   (~$0.99 — entry tier)
 *   coin_pack_medium →  60 coins   (~$4.99 — popular)
 *   coin_pack_large  → 150 coins   (~$9.99 — bulk)
 *   coin_pack_mega   → 400 coins   (~$24.99 — whale)
 *
 * Config is env-driven so staging/prod can use different packs without code changes.
 */
export interface CoinPack {
  productId: string;
  coins: number;
  /// Suggested price label (e.g. "9,99 ₺"). The actual price comes from Play
  /// Console via the in_app_purchase SDK; this is a fallback for display only.
  displayPriceLabel: string;
}

@Injectable()
export class ProductsConfig {
  private readonly packs: CoinPack[];

  constructor(config: ConfigService) {
    this.packs = [
      {
        productId: config.get<string>('COIN_PACK_SMALL_ID') ?? 'coin_pack_small',
        coins: config.get<number>('COIN_PACK_SMALL_AMOUNT') ?? 10,
        displayPriceLabel: config.get<string>('COIN_PACK_SMALL_PRICE') ?? '$0.99',
      },
      {
        productId: config.get<string>('COIN_PACK_MEDIUM_ID') ?? 'coin_pack_medium',
        coins: config.get<number>('COIN_PACK_MEDIUM_AMOUNT') ?? 60,
        displayPriceLabel: config.get<string>('COIN_PACK_MEDIUM_PRICE') ?? '$4.99',
      },
      {
        productId: config.get<string>('COIN_PACK_LARGE_ID') ?? 'coin_pack_large',
        coins: config.get<number>('COIN_PACK_LARGE_AMOUNT') ?? 150,
        displayPriceLabel: config.get<string>('COIN_PACK_LARGE_PRICE') ?? '$9.99',
      },
      {
        productId: config.get<string>('COIN_PACK_MEGA_ID') ?? 'coin_pack_mega',
        coins: config.get<number>('COIN_PACK_MEGA_AMOUNT') ?? 400,
        displayPriceLabel: config.get<string>('COIN_PACK_MEGA_PRICE') ?? '$24.99',
      },
    ];
  }

  /** All packs — used by the GET /api/billing/products endpoint. */
  listPacks(): CoinPack[] {
    return [...this.packs];
  }

  /** Look up a pack by productId. Returns undefined if not found. */
  findByProductId(productId: string): CoinPack | undefined {
    return this.packs.find((p) => p.productId === productId);
  }

  /** All product IDs — used by the in_app_purchase SDK to query Play Console. */
  productIds(): string[] {
    return this.packs.map((p) => p.productId);
  }
}
