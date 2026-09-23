import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * DeletionService — runs the actual anonymization for accounts whose
 * DeletionRequest.scheduledAt has passed.
 *
 * Anonymization steps:
 *   1. Revoke all refresh tokens for the user.
 *   2. Null out firebasePhone, firebaseUid (replaced with anonymized value),
 *      googleSubject.
 *   3. Delete the profile row (cascade doesn't apply since it's 1:1).
 *   4. Mark DeletionRequest.executedAt = now.
 *
 * Wallet, calls, reports are kept for audit. This is the right call legally —
 * financial records and dispute evidence must be retained.
 *
 * Phase 2 stub: the runner is exposed but the cron is wired in Phase 7
 * (FCM/push infra lands then).
 */
@Injectable()
export class DeletionService {
  private readonly logger = new Logger(DeletionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Process all due deletion requests. Returns count of processed accounts.
   * Called by the scheduled cron — also exposed as POST /admin/anonymize-due
   * (Phase 8 admin route).
   */
  async processDue(): Promise<number> {
    const now = new Date();
    const due = await this.prisma.deletionRequest.findMany({
      where: {
        scheduledAt: { lte: now },
        executedAt: null,
        canceledAt: null,
      },
      include: { user: true },
    });
    for (const req of due) {
      await this.anonymize(req.userId, req.id);
    }
    return due.length;
  }

  /** Anonymize a single user — used by processDue + Phase 8 admin override. */
  async anonymize(userId: string, deletionRequestId?: string): Promise<void> {
    this.logger.log(`Anonymizing user ${userId}`);

    // 1. Revoke all refresh tokens.
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    });

    // 2. Anonymize PII fields on User. firebaseUid must stay unique, so we
    //    replace with a per-user anonymized value.
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        firebaseUid: `anon-${userId}`,
        firebasePhone: null,
        googleSubject: null,
        status: 'BANNED', // BANNED prevents re-login on same firebaseUid... but we changed it.
        lastSeenAt: new Date(),
      },
    });

    // 3. Delete profile.
    await this.prisma.profile.deleteMany({ where: { userId } });

    // 4. Mark request as executed.
    if (deletionRequestId) {
      await this.prisma.deletionRequest.update({
        where: { id: deletionRequestId },
        data: { executedAt: new Date() },
      });
    }
  }
}
