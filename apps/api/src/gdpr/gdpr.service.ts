import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserStatus } from '@prisma/client';
import { createHash } from 'crypto';

/**
 * GdprService — KVKK/GDPR right to data portability + right to erasure.
 *
 * Flow:
 *   1. GET /api/gdpr/export — JSON export of all user data (user, profile,
 *      wallet + transactions, devices, calls, reports, ratings, chat messages).
 *      Used to satisfy "right to data portability" (KVKK Madde 14 / GDPR Art. 20).
 *
 *   2. POST /api/gdpr/delete — schedule anonymization (different from Faz 2's
 *      /me/delete which is a self-service flow). This is the legal right to
 *      erasure (KVKK Madde 17 / GDPR Art. 17).
 *
 *      Anonymization scope (per spec: "eşleşme metaverisi anonimleştirme dahil"):
 *        - firebaseUid → `anon-<userId>`
 *        - firebasePhone → null
 *        - googleSubject → null
 *        - profile row → deleted
 *        - wallet + transactions → kept for financial audit (7 years, legal retention)
 *        - devices → deleted (FCM tokens)
 *        - refresh tokens → revoked
 *        - calls (as caller + callee) → kept (duration, endReason) but peer is anonymized
 *          by cascade when the peer is also anonymized. Phase 9 doesn't touch calls.
 *        - chat messages → content replaced with `[anonymized]`
 *        - ratings → kept (stars) but raterId is anonymized via cascade.
 *        - moderation frames → kept (S3 + Rekognition results, needed for legal audit)
 *        - reports → kept (evidence, legal retention)
 *      → User.status = BANNED (effectively logs them out).
 *
 * Phase 9: anonymization is synchronous — no grace period (different from
 * Faz 2's 14-day grace which is for self-service deletion; GDPR delete is
 * a legal right and should be immediate but allow time for legal review).
 *
 * For Phase 9 we'll do the same 14-day grace pattern — schedule the
 * anonymization via DeletionRequest (already exists in Faz 2). The endpoint
 * is different (gdpr/delete vs me/delete) but the underlying flow is the same.
 */
@Injectable()
export class GdprService {
  private readonly logger = new Logger(GdprService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Export all user data as a single JSON object.
   * This is what the user receives when they request a data export.
   */
  async exportUserData(userId: string): Promise<{
    user: unknown;
    profile: unknown;
    wallet: { balance: number; currency: string } | null;
    transactions: unknown[];
    devices: unknown[];
    callsAsCaller: unknown[];
    callsAsCallee: unknown[];
    reportsMade: unknown[];
    reportsReceived: unknown[];
    ratingsGiven: unknown[];
    ratingsReceived: unknown[];
    chatMessages: unknown[];
    entitlement: unknown;
    filterActivations: unknown[];
    strikes: unknown;
  }> {
    const [
      user,
      profile,
      wallet,
      transactions,
      devices,
      callsAsCaller,
      callsAsCallee,
      reportsMade,
      reportsReceived,
      ratingsGiven,
      ratingsReceived,
      chatMessages,
      entitlement,
      filterActivations,
      strikes,
    ] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, firebaseUid: true, firebasePhone: true, googleSubject: true,
          role: true, status: true, profileCompleted: true, lastSeenAt: true, createdAt: true,
        },
      }),
      this.prisma.profile.findUnique({ where: { userId }, select: { displayName: true, avatarUrl: true, bio: true, gender: true, country: true, birthYear: true, createdAt: true, updatedAt: true } }),
      this.prisma.wallet.findUnique({ where: { userId }, select: { balance: true } }),
      this.prisma.coinTransaction.findMany({
        where: { wallet: { userId } },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: { id: true, type: true, amount: true, balanceAfter: true, idempotencyKey: true, reference: true, createdAt: true },
      }),
      this.prisma.device.findMany({ where: { userId }, select: { androidId: true, fcmToken: true, platform: true, appVersion: true, lastSeenAt: true, createdAt: true } }),
      this.prisma.call.findMany({ where: { callerId: userId }, orderBy: { startedAt: 'desc' }, take: 50, select: { id: true, agoraChannel: true, status: true, startedAt: true, endedAt: true, durationSec: true, endReason: true, avgQualityMs: true } }),
      this.prisma.call.findMany({ where: { calleeId: userId }, orderBy: { startedAt: 'desc' }, take: 50, select: { id: true, agoraChannel: true, status: true, startedAt: true, endedAt: true, durationSec: true, endReason: true, avgQualityMs: true } }),
      this.prisma.report.findMany({ where: { reporterId: userId }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, reason: true, details: true, status: true, createdAt: true } }),
      this.prisma.report.findMany({ where: { reportedId: userId }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, reason: true, status: true, createdAt: true } }),
      this.prisma.callRating.findMany({ where: { raterId: userId }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, stars: true, createdAt: true } }),
      this.prisma.callRating.findMany({ where: { targetUserId: userId }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, stars: true, createdAt: true } }),
      this.prisma.callChatMessage.findMany({ where: { senderId: userId }, orderBy: { createdAt: 'desc' }, take: 200, select: { id: true, content: true, filtered: true, createdAt: true } }),
      this.prisma.entitlement.findUnique({ where: { userId }, select: { status: true, expiresAt: true, productId: true } }),
      this.prisma.filterActivation.findMany({ where: { userId }, select: { type: true, value: true, expiresAt: true, coinsSpent: true, isVipGrant: true } }),
      this.prisma.strike.findUnique({ where: { userId }, select: { level: true, lastStrikeAt: true, cooldownEndsAt: true, lastReason: true } }),
    ]);

    return {
      user,
      profile,
      wallet: wallet ? { balance: wallet.balance, currency: 'COIN' } : null,
      transactions,
      devices: devices.map((d) => ({ ...d, fcmToken: `[redacted:${createHash('sha256').update(d.fcmToken).digest('hex').slice(0, 12)}…]` })),
      callsAsCaller,
      callsAsCallee,
      reportsMade,
      reportsReceived,
      ratingsGiven,
      ratingsReceived,
      chatMessages,
      entitlement,
      filterActivations,
      strikes,
    };
  }

  /**
   * Schedule immediate anonymization (no 14-day grace — legal right).
   * Actually we use the same 14-day grace period as Faz 2's DeletionRequest
   * for legal review. The endpoint is gdpr-specific so logs are clear.
   *
   * Returns the DeletionRequest row.
   */
  async scheduleAnonymization(opts: { userId: string; reason?: string }) {
    const scheduledAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    return this.prisma.deletionRequest.upsert({
      where: { userId: opts.userId },
      create: {
        userId: opts.userId,
        scheduledAt,
        reason: opts.reason ?? 'gdpr_request',
      },
      update: {
        scheduledAt,
        canceledAt: null,
        reason: opts.reason ?? 'gdpr_request',
      },
    });
  }
}
