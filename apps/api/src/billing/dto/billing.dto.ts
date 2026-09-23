import { IsEnum, IsString, MaxLength } from 'class-validator';

/** POST /billing/verify-purchase — client sends after successful Play purchase. */
export class VerifyPurchaseDto {
  /// Play Console product ID (e.g. "coin_pack_small").
  @IsString()
  @MaxLength(64)
  productId!: string;

  /// Raw purchase token returned by Google Play Billing client.
  @IsString()
  @MaxLength(512)
  purchaseToken!: string;
}

/** POST /billing/rtdn-webhook — body is the raw Pub/Sub message. */
export class RtdnWebhookDto {
  /// Pub/Sub message envelope — we accept `any` shape since Google sends JSON
  /// we don't fully control. Server parses `message.data` (base64) → JSON.
  message?: unknown;
}

export const NOTIFICATION_TYPES = [
  'ONE_TIME_PRODUCT_PURCHASED',
  'ONE_TIME_PRODUCT_CANCELED',
  'REFUNDED',
  'VOIDED',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
