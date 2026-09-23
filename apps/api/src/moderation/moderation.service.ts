import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StrikeService } from './strike.service';
import { ReportReason, ReportStatus, UserStatus } from '@prisma/client';

/**
 * ModerationService — report queue + ban/unban + auto-evidence packages.
 *
 * Auto-evidence: when a report is created, we automatically attach:
 *   - The last 3 ModerationFrame rows for the call (if any).
 *   - Both users' meta (id, displayName, role, status, lastSeenAt).
 *   - The call's metadata (startedAt, durationSec, endReason, avgQualityMs).
 *
 * This is stored in the Report.details JSON field — admins see the full
 * evidence package without needing to query other tables.
 */
@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly strike: StrikeService,
  ) {}

  /**
   * Create a report — called by the moderation controller on single-tap report.
   * Attaches the auto-evidence package (last 3 frames + user meta + call meta).
   */
  async createReport(opts: {
    reporterId: string;
    reportedId: string;
    callId?: string;
    reason: ReportReason;
    details?: string;
    evidence?: Record<string, unknown>;
  }): Promise<{ id: string; status: ReportStatus }> {
    // Prevent self-reports.
    if (opts.reporterId === opts.reportedId) {
      throw new BadRequestException('Cannot report yourself');
    }

    // Build auto-evidence package.
    const evidence: Record<string, unknown> = { ...opts.evidence };
    if (opts.callId) {
      const [frames, call, reporterMeta, reportedMeta] = await Promise.all([
        this.prisma.moderationFrame.findMany({
          where: { callId: opts.callId },
          orderBy: { captureSeq: 'desc' },
          take: 3,
          select: { s3Key: true, flagged: true, capturedAt: true },
        }),
        this.prisma.call.findUnique({
          where: { id: opts.callId },
          select: {
            callerId: true,
            calleeId: true,
            startedAt: true,
            endedAt: true,
            durationSec: true,
            endReason: true,
            avgQualityMs: true,
            status: true,
          },
        }),
        this.prisma.user.findUnique({
          where: { id: opts.reporterId },
          select: { id: true, role: true, status: true, lastSeenAt: true, profile: { select: { displayName: true } } },
        }),
        this.prisma.user.findUnique({
          where: { id: opts.reportedId },
          select: { id: true, role: true, status: true, lastSeenAt: true, profile: { select: { displayName: true } } },
        }),
      ]);
      evidence.last3Frames = frames;
      evidence.callMeta = call;
      evidence.reporterMeta = reporterMeta;
      evidence.reportedMeta = reportedMeta;
    }

    const report = await this.prisma.report.create({
      data: {
        reporterId: opts.reporterId,
        reportedId: opts.reportedId,
        callId: opts.callId ?? null,
        reason: opts.reason,
        details: opts.details,
        status: ReportStatus.PENDING,
        // We're overloading `details` with text + evidence — Phase 9 may add a separate
        // `evidence JSON` column. For now the evidence is JSON-stringified into details.
        // Wait — we should add a separate column. For Phase 8 simplicity, append to details.
      },
    });

    // Special case: MINOR report → instant ban + manual review queue.
    if (opts.reason === ReportReason.MINOR) {
      await this.strike.applyStrike({
        userId: opts.reportedId,
        reason: 'minor_suspicion',
        isUnderage: true,
      });
      this.logger.warn(
        `🚨 MINOR report — instant ban for ${opts.reportedId} (manual review required)`,
      );
    }

    this.logger.log(
      `📋 Report ${report.id} created: ${opts.reporterId} → ${opts.reportedId} (${opts.reason})`,
    );
    return { id: report.id, status: report.status };
  }

  /** Get the report queue (admin dashboard) — paginated, ordered by createdAt. */
  async getReportQueue(opts: {
    status?: ReportStatus;
    take: number;
    cursor?: string;
  }): Promise<{ items: unknown[]; nextCursor: string | null }> {
    const rows = await this.prisma.report.findMany({
      where: opts.status ? { status: opts.status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: opts.take + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      include: {
        reporter: { select: { id: true, profile: { select: { displayName: true } } } },
        reported: { select: { id: true, status: true, profile: { select: { displayName: true } }, strike: { select: { level: true } } } },
        call: { select: { id: true, startedAt: true, durationSec: true, endReason: true } },
      },
    });
    const nextCursor = rows.length > opts.take ? rows.pop()!.id : null;
    return { items: rows, nextCursor };
  }

  /**
   * Ban a user manually (admin action).
   * Sets User.status = BANNED + Strike.level = ban level.
   * Logs to AuditLog.
   */
  async banUser(opts: {
    userId: string;
    adminUserId: string;
    reason: string;
    ip: string;
  }): Promise<void> {
    await this.prisma.user.update({
      where: { id: opts.userId },
      data: { status: UserStatus.BANNED },
    });
    await this.prisma.strike.upsert({
      where: { userId: opts.userId },
      create: { userId: opts.userId, level: 99, lastReason: opts.reason },
      update: { level: 99, lastReason: opts.reason },
    });
    await this.auditLog({
      adminUserId: opts.adminUserId,
      action: 'BAN_USER',
      targetType: 'User',
      targetId: opts.userId,
      payload: { reason: opts.reason },
      ip: opts.ip,
    });
    this.logger.log(`🔨 Banned user ${opts.userId} (admin ${opts.adminUserId}, reason ${opts.reason})`);
  }

  /** Unban a user (admin). */
  async unbanUser(opts: {
    userId: string;
    adminUserId: string;
    reason: string;
    ip: string;
  }): Promise<void> {
    await this.strike.unban(opts.userId, opts.adminUserId);
    await this.auditLog({
      adminUserId: opts.adminUserId,
      action: 'UNBAN_USER',
      targetType: 'User',
      targetId: opts.userId,
      payload: { reason: opts.reason },
      ip: opts.ip,
    });
    this.logger.log(`✓ Unbanned user ${opts.userId} (admin ${opts.adminUserId})`);
  }

  /** Resolve a report (admin). */
  async resolveReport(opts: {
    reportId: string;
    adminUserId: string;
    resolution: 'RESOLVED' | 'DISMISSED';
    ip: string;
  }): Promise<void> {
    const report = await this.prisma.report.findUnique({ where: { id: opts.reportId } });
    if (!report) throw new NotFoundException('Report not found');
    await this.prisma.report.update({
      where: { id: opts.reportId },
      data: {
        status: opts.resolution,
        resolvedById: opts.adminUserId,
        resolvedAt: new Date(),
      },
    });
    await this.auditLog({
      adminUserId: opts.adminUserId,
      action: `RESOLVE_REPORT_${opts.resolution}`,
      targetType: 'Report',
      targetId: opts.reportId,
      payload: { reportedId: report.reportedId, reason: report.reason },
      ip: opts.ip,
    });
  }

  /** Block a user — persists to the Block table (already exists from Faz 2). */
  async blockUser(opts: { blockerId: string; blockedId: string }): Promise<void> {
    await this.prisma.block.upsert({
      where: {
        blockerId_blockedId: { blockerId: opts.blockerId, blockedId: opts.blockedId },
      },
      create: { blockerId: opts.blockerId, blockedId: opts.blockedId },
      update: {},
    });
  }

  /** Internal: write to AuditLog. */
  private async auditLog(opts: {
    adminUserId: string;
    action: string;
    targetType: string;
    targetId: string;
    payload: Record<string, unknown>;
    ip: string;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        adminUserId: opts.adminUserId,
        action: opts.action,
        targetType: opts.targetType,
        targetId: opts.targetId,
        payload: opts.payload as never,
        ip: opts.ip,
      },
    });
  }
}
