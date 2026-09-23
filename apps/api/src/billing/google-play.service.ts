import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { webcrypto as crypto } from 'crypto';

/**
 * GooglePlayService — wraps the Google Play Developer API (androidpublisher v3).
 *
 * Used to:
 *   1. Verify a purchase token (POST /billing/verify-purchase flow).
 *   2. Acknowledge a consumable purchase (so it can be bought again).
 *   3. Look up purchases during RTDN refund handling.
 *
 * Auth: Service Account JWT (OAuth2 access token). The service account JSON
 * is stored as `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` env var (stringified JSON).
 * The account must be granted "Finance" + "Android Publisher Admin" roles in
 * the Play Console → Setup → API Access section.
 *
 * Phase 6 dev bypass: if no service account is configured, verifyPurchase
 * returns a fake "VERIFIED" response so CI/local works without real Google.
 * Real Google Play calls require both GOOGLE_PLAY_PACKAGE_NAME + the SA JSON.
 *
 * Why we use raw HTTP (not the `googleapis` npm package): smaller dep surface,
 * no version drift with @nestjs/* packages, full control over retries.
 */
@Injectable()
export class GooglePlayService {
  private readonly logger = new Logger(GooglePlayService.name);
  private readonly packageName: string;
  private readonly serviceAccountJson: string | null;
  private cachedAccessToken: { token: string; expiresAt: number } | null = null;

  constructor(config: ConfigService) {
    this.packageName = config.get<string>('GOOGLE_PLAY_PACKAGE_NAME') ?? '';
    this.serviceAccountJson = config.get<string>('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON') ?? '';
    if (!this.serviceAccountJson) {
      this.logger.warn('⚠️  GOOGLE_PLAY_SERVICE_ACCOUNT_JSON not set — dev bypass mode');
    }
  }

  get isConfigured(): boolean {
    return !!this.serviceAccountJson && !!this.packageName;
  }

  /**
   * Verify a purchase token against Google Play.
   * Returns the canonical purchase state + consumptionState + orderId.
   *
   *   GET https://androidpublisher.googleapis.com/v3/applications/{packageName}/purchases/products/{productId}/tokens/{purchaseToken}
   *
   * See: https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products/get
   */
  async verifyPurchase(opts: {
    productId: string;
    purchaseToken: string;
  }): Promise<{
    purchaseState: 'PENDING' | 'PURCHASED' | 'CANCELED';
    consumptionState: 'YET_TO_BE_CONSUMED' | 'CONSUMED';
    orderId: string;
    quantity: number;
    raw: unknown;
  }> {
    if (!this.isConfigured) {
      // Dev bypass — accept any token, return a fake orderId derived from the token hash.
      this.logger.debug(`Dev bypass: faking verify for ${opts.productId}/${opts.purchaseToken.slice(0, 12)}…`);
      const fakeOrderId = `dev-order-${opts.productId}-${opts.purchaseToken.slice(0, 16)}`;
      return {
        purchaseState: 'PURCHASED',
        consumptionState: 'YET_TO_BE_CONSUMED',
        orderId: fakeOrderId,
        quantity: 1,
        raw: { devBypass: true },
      };
    }

    const token = await this.getAccessToken();
    const url = `https://androidpublisher.googleapis.com/v3/applications/${this.packageName}/purchases/products/${encodeURIComponent(opts.productId)}/tokens/${encodeURIComponent(opts.purchaseToken)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new BadRequestException(`Google Play verify failed (${res.status}): ${body}`);
    }
    const data = (await res.json()) as {
      purchaseState: number; // 0=PENDING, 1=PURCHASED, 2=CANCELED
      consumptionState: number; // 0=YET_TO_BE_CONSUMED, 1=CONSUMED
      orderId?: string;
      quantity?: number;
    };
    return {
      purchaseState: data.purchaseState === 0 ? 'PENDING' : data.purchaseState === 2 ? 'CANCELED' : 'PURCHASED',
      consumptionState: data.consumptionState === 1 ? 'CONSUMED' : 'YET_TO_BE_CONSUMED',
      orderId: data.orderId ?? '',
      quantity: data.quantity ?? 1,
      raw: data,
    };
  }

  /**
   * Acknowledge a consumable purchase — required so the user can buy again.
   *   POST https://androidpublisher.googleapis.com/v3/applications/{packageName}/purchases/products/{productId}/tokens/{purchaseToken}:acknowledge
   *
   * Idempotent — Play allows calling this multiple times.
   */
  async acknowledgePurchase(opts: {
    productId: string;
    purchaseToken: string;
  }): Promise<void> {
    if (!this.isConfigured) {
      this.logger.debug(`Dev bypass: faking acknowledge for ${opts.productId}`);
      return;
    }
    const token = await this.getAccessToken();
    const url = `https://androidpublisher.googleapis.com/v3/applications/${this.packageName}/purchases/products/${encodeURIComponent(opts.productId)}/tokens/${encodeURIComponent(opts.purchaseToken)}:acknowledge`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok && res.status !== 404) {
      // 404 = already acknowledged — fine.
      const body = await res.text();
      throw new ServiceUnavailableException(`Google Play acknowledge failed (${res.status}): ${body}`);
    }
  }

  /**
   * Phase 7: Verify a subscription purchase token via the v2 API.
   * Returns the canonical state — active/expired/canceled + next billing date.
   *
   *   GET https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{packageName}/purchases/subscriptionsv2/tokens/{purchaseToken}
   */
  async verifySubscription(opts: {
    purchaseToken: string;
  }): Promise<{
    state: 'ACTIVE' | 'CANCELED' | 'EXPIRED' | 'GRACE' | 'PAUSED' | 'UNKNOWN';
    expiresAt: Date | null;
    productId: string | null;
    raw: unknown;
  }> {
    if (!this.isConfigured) {
      // Dev bypass — fake an active subscription for 30 days.
      this.logger.debug(`Dev bypass: faking verify-subscription for ${opts.purchaseToken.slice(0, 12)}…`);
      return {
        state: 'ACTIVE',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        productId: 'vip_monthly',
        raw: { devBypass: true },
      };
    }
    const token = await this.getAccessToken();
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${this.packageName}/purchases/subscriptionsv2/tokens/${encodeURIComponent(opts.purchaseToken)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new BadRequestException(`Google Play subscription verify failed (${res.status}): ${body}`);
    }
    const data = (await res.json()) as {
      subscriptionState?: string;
      lineItems?: Array<{
        productId?: string;
        expiryTime?: string;
      }>;
    };
    // Map Play's subscriptionState enum to our internal state.
    const stateRaw = data.subscriptionState ?? 'SUBSCRIPTION_STATE_UNKNOWN';
    let state: 'ACTIVE' | 'CANCELED' | 'EXPIRED' | 'GRACE' | 'PAUSED' | 'UNKNOWN' = 'UNKNOWN';
    if (stateRaw.includes('ACTIVE')) state = 'ACTIVE';
    else if (stateRaw.includes('CANCELED')) state = 'CANCELED';
    else if (stateRaw.includes('EXPIRED')) state = 'EXPIRED';
    else if (stateRaw.includes('GRACE')) state = 'GRACE';
    else if (stateRaw.includes('PAUSED')) state = 'PAUSED';

    const firstItem = data.lineItems?.[0];
    const expiresAt = firstItem?.expiryTime ? new Date(firstItem.expiryTime) : null;
    const productId = firstItem?.productId ?? null;
    return { state, expiresAt, productId, raw: data };
  }

  /**
   * Fetch an OAuth2 access token using the Service Account JWT flow.
   * Cached for ~50 minutes (tokens are valid for 60).
   */
  private async getAccessToken(): Promise<string> {
    if (this.cachedAccessToken && Date.now() < this.cachedAccessToken.expiresAt) {
      return this.cachedAccessToken.token;
    }
    if (!this.serviceAccountJson) {
      throw new ServiceUnavailableException('Google Play service account not configured');
    }
    const sa = JSON.parse(this.serviceAccountJson) as {
      client_email: string;
      private_key: string;
    };
    const jwt = await this.buildServiceAccountJwt(sa);
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });
    if (!res.ok) {
      throw new ServiceUnavailableException(`Google OAuth failed: ${await res.text()}`);
    }
    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.cachedAccessToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 120) * 1000,
    };
    return data.access_token;
  }

  /**
   * Build a JWT signed with the service account's private key.
   * RS256 — Node's WebCrypto subtle.sign handles it natively.
   */
  private async buildServiceAccountJwt(sa: { client_email: string; private_key: string }): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    };
    const enc = (o: unknown) =>
      Buffer.from(JSON.stringify(o)).toString('base64url');
    const unsigned = `${enc(header)}.${enc(payload)}`;
    const key = await this.importPrivateKey(sa.private_key);
    const sig = await crypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5' },
      key,
      new TextEncoder().encode(unsigned),
    );
    const sigB64 = Buffer.from(new Uint8Array(sig)).toString('base64url');
    return `${unsigned}.${sigB64}`;
  }

  private async importPrivateKey(pem: string): Promise<crypto.CryptoKey> {
    // PEM → DER → import
    const pemBody = pem
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/\s/g, '');
    const der = Buffer.from(pemBody, 'base64');
    return crypto.subtle.importKey(
      'pkcs8',
      der,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    );
  }
}
