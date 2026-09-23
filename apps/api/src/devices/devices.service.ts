import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Platform } from '@prisma/client';

/**
 * DevicesService — registers/updates a device for a user.
 *
 * Lifecycle:
 *   1. User opens app on phone → POST /devices with { androidId, fcmToken, appVersion }
 *   2. We look up existing row by (userId, androidId). If found, update fcmToken + appVersion.
 *      If not, create new row.
 *   3. On logout, the auth flow revokes all refresh tokens for this device — but
 *      the device row stays so we can re-recognize it on next login.
 */
@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upsert a device record. Returns the device id — used by auth flow
   * to attach the refresh token to this device.
   */
  async registerDevice(opts: {
    userId: string;
    androidId?: string;
    fcmToken: string;
    platform: Platform;
    appVersion?: string;
  }): Promise<{ deviceId: string }> {
    const { userId, androidId, fcmToken, platform, appVersion } = opts;

    // If androidId provided, try upsert by (userId, androidId).
    // Otherwise (iOS, dev), fall back to upsert by fcmToken.
    if (androidId) {
      // Find existing device by (userId, androidId) — may have stale fcmToken.
      const existing = await this.prisma.device.findFirst({
        where: { userId, androidId },
      });
      if (existing) {
        const updated = await this.prisma.device.update({
          where: { id: existing.id },
          data: {
            fcmToken,
            appVersion,
            lastSeenAt: new Date(),
          },
        });
        return { deviceId: updated.id };
      }
    }

    // No existing (userId, androidId) row. Create new. If fcmToken is taken
    // (rare — could happen if user logged out then back in on same FCM),
    // delete the stale row first.
    await this.prisma.device
      .deleteMany({ where: { fcmToken } })
      .catch((e) => this.logger.warn(`Stale fcmToken cleanup: ${(e as Error).message}`));

    const device = await this.prisma.device.create({
      data: {
        userId,
        androidId,
        fcmToken,
        platform,
        appVersion,
      },
    });
    return { deviceId: device.id };
  }

  /** Revoke all refresh tokens for a device — used on logout. */
  async revokeTokensForDevice(deviceId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { deviceId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Touch lastSeenAt — called by presence heartbeat (Phase 3). */
  async touchLastSeen(deviceId: string): Promise<void> {
    await this.prisma.device.update({
      where: { id: deviceId },
      data: { lastSeenAt: new Date() },
    });
  }
}
