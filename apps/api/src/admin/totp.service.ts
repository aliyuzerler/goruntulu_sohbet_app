import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';

/**
 * TOTPService — RFC 6238 TOTP (Time-Based One-Time Password).
 * Used for mandatory admin 2FA.
 *
 * Algorithm: HOTP(K, T) where T = floor((unix_time - T0) / step).
 *   K = shared secret (base32-encoded, 20 bytes raw)
 *   T0 = 0 (Unix epoch)
 *   step = 30 seconds
 *   digits = 6
 *
 * Phase 10: no external dep — pure Node crypto.
 * The secret is stored in AdminUser.totpSecret (base32).
 * The user scans a QR code (otpauth:// URL) in an authenticator app
 * (Google Authenticator, Authy, etc.) and enters the 6-digit code on login.
 */
@Injectable()
export class TotpService {
  private readonly logger = new Logger(TotpService.name);
  private readonly step = 30;
  private readonly digits = 6;
  private readonly window = 1; // ±1 step tolerance (±30s clock skew)

  /** Generate a new random TOTP secret (base32, 20 bytes raw). */
  generateSecret(): string {
    const bytes = randomBytes(20);
    return this.base32Encode(bytes);
  }

  /**
   * Build the otpauth:// URL for QR code scanning.
   *   otpauth://totp/RandChat:admin@example.com?secret=BASE32&issuer=RandChat&algorithm=SHA1&digits=6&period=30
   */
  buildOtpAuthUrl(opts: { email: string; secret: string; issuer?: string }): string {
    const issuer = opts.issuer ?? 'RandChat';
    const label = encodeURIComponent(`${issuer}:${opts.email}`);
    const params = new URLSearchParams({
      secret: opts.secret,
      issuer,
      algorithm: 'SHA1',
      digits: String(this.digits),
      period: String(this.step),
    });
    return `otpauth://totp/${label}?${params}`;
  }

  /**
   * Verify a TOTP code against a secret.
   * Checks the current time step ± window (default ±1 = ±30s).
   * Returns true if the code is valid for any step in the window.
   */
  verify(opts: { secret: string; token: string }): boolean {
    if (!opts.secret || !opts.token) return false;
    const token = opts.token.replace(/\s/g, '');
    if (token.length !== this.digits || !/^\d+$/.test(token)) return false;

    const key = this.base32Decode(opts.secret);
    if (!key) return false;

    const now = Math.floor(Date.now() / 1000);
    const counter = Math.floor(now / this.step);

    for (let offset = -this.window; offset <= this.window; offset++) {
      const expected = this.hotp(key, counter + offset);
      if (expected === token) return true;
    }
    return false;
  }

  /** HOTP: HMAC-SHA1(K, counter) → truncate → 6-digit code. */
  private hotp(key: Buffer, counter: number): string {
    const buf = Buffer.alloc(8);
    // Counter is 64-bit big-endian — JS only handles 32-bit safely, but
    // for TOTP the high 32 bits are always 0 (counter < 2^32 for the next 100+ years).
    buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
    buf.writeUInt32BE(counter & 0xffffffff, 4);
    const hmac = createHmac('sha1', key).update(buf).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);
    const token = binary % Math.pow(10, this.digits);
    return String(token).padStart(this.digits, '0');
  }

  /** Base32 encode (RFC 4648) — used for TOTP secrets. */
  private base32Encode(bytes: Buffer): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    let output = '';
    for (const byte of bytes) {
      value = (value << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        output += alphabet[(value >> (bits - 5)) & 0x1f];
        bits -= 5;
      }
    }
    if (bits > 0) {
      output += alphabet[(value << (5 - bits)) & 0x1f];
    }
    return output;
  }

  /** Base32 decode (RFC 4648). */
  private base32Decode(encoded: string): Buffer | null {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const lookup = new Map<string, number>();
    for (let i = 0; i < alphabet.length; i++) {
      lookup.set(alphabet[i], i);
    }
    const clean = encoded.toUpperCase().replace(/=/g, '');
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];
    for (const char of clean) {
      const idx = lookup.get(char);
      if (idx === undefined) return null;
      value = (value << 5) | idx;
      bits += 5;
      while (bits >= 8) {
        bytes.push((value >> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }
    return Buffer.from(bytes);
  }
}
