import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { ModerationService } from '../moderation/moderation.service';
import { CoinTxType, UserStatus, CallStatus } from '@prisma/client';

/**
 * AdminService — admin panel backend: dashboard KPIs, user management,
 * FCM broadcast (stub), audit log viewer.
 *
 * ALL actions write to AuditLog:
 *   - BAN_USER, UNBAN_USER
 *   - COIN_ADJUST (with mandatory note)
 *   - BROADCAST_FCM
 *
 * Roles:
 *   MODERATOR — can view dashboard, view users, resolve reports
 *   ADMIN — can also ban/unban, adjust coins, broadcast FCM, set remote config
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    public readonly moderation: ModerationService,
  ) {}

  // ─── Dashboard KPIs ──────────────────────────────────────────────────

  /**
   * Get real-time dashboard KPIs:
   *   - Online users (count)
   *   - Active calls (status=ACTIVE)
   *   - Daily matches + skips ratio
   *   - Pending reports count
   *   - Today's revenue (sum of PURCHASE + SPEND_* transactions)
   */
  async getDashboardKPIs(): Promise<{
    onlineUsers: number;
    activeCalls: number;
    dailyMatches: number;
    dailySkips: number;
    pendingReports: number;
    todayRevenue: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      activeCalls,
      dailyMatchesCount,
      dailySkipsCount,
      pendingReports,
      todayRevenueRows,
    ] = await Promise.all([
      this.prisma.call.count({ where: { status: CallStatus.ACTIVE } }),
      // Calls that ended today with endReason != timeout/moderation (successful matches)
      this.prisma.call.count({
        where: {
          startedAt: { gte: today },
          status: { in: [CallStatus.ENDED, CallStatus.ACTIVE, CallStatus.REPORTED] },
        },
      }),
      // Calls that ended today with endReason=user_left (skip)
      this.prisma.call.count({
        where: {
          startedAt: { gte: today },
          endReason: 'user_left',
        },
      }),
      this.prisma.report.count({ where: { status: 'PENDING' } }),
      // Revenue = sum of positive CoinTransaction amounts today
      this.prisma.coinTransaction.findMany({
        where: {
          createdAt: { gte: today },
          type: CoinTxType.PURCHASE,
        },
        select: { amount: true },
      }),
    ]);

    const todayRevenue = todayRevenueRows.reduce((sum, tx) => sum + tx.amount, 0);

    // Online users: count from Redis presence set — Phase 10 stub
    // (actual presence count would call PresenceService.getOnlineCount()).
    // For now, approximate with users whose lastSeenAt is within 5 min.
    const onlineUsers = await this.prisma.user.count({
      where: {
        lastSeenAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
        status: UserStatus.ACTIVE,
      },
    });

    return {
      onlineUsers,
      activeCalls,
      dailyMatches: dailyMatchesCount,
      dailySkips: dailySkipsCount,
      pendingReports,
      todayRevenue,
    };
  }

  /**
   * Get 7-day time series for dashboard chart.
   * Returns array of 7 entries: { date, matches, skips, reports, revenue }.
   */
  async getDashboard7DaySeries(): Promise<
    Array<{ date: string; matches: number; skips: number; reports: number; revenue: number }>
  > {
    const out: Array<{ date: string; matches: number; skips: number; reports: number; revenue: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const start = new Date();
      start.setDate(start.getDate() - i);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const [matches, skips, reports, revenueRows] = await Promise.all([
        this.prisma.call.count({
          where: {
            startedAt: { gte: start, lt: end },
            status: { in: [CallStatus.ENDED, CallStatus.ACTIVE, CallStatus.REPORTED] },
          },
        }),
        this.prisma.call.count({
          where: {
            startedAt: { gte: start, lt: end },
            endReason: 'user_left',
          },
        }),
        this.prisma.report.count({
          where: { createdAt: { gte: start, lt: end } },
        }),
        this.prisma.coinTransaction.findMany({
          where: {
            createdAt: { gte: start, lt: end },
            type: CoinTxType.PURCHASE,
          },
          select: { amount: true },
        }),
      ]);
      const revenue = revenueRows.reduce((s, r) => s + r.amount, 0);
      const dateStr = `${start.getDate()}.${start.getMonth() + 1}`;
      out.push({ date: dateStr, matches, skips, reports, revenue });
    }
    return out;
  }

  // ─── User management ─────────────────────────────────────────────────

  /**
   * Search users by id (UUID prefix), nickname, or phone hash.
   * Phase 10 simple: LIKE search on profile.displayName + exact on User.id.
   */
  async searchUsers(query: string, take = 20): Promise<unknown[]> {
    const where = query.length === 36
      ? { id: query } // exact UUID
      : {
          OR: [
            { profile: { displayName: { contains: query, mode: 'insensitive' as const } } },
            { firebasePhone: { contains: query } },
          ],
        };
    return this.prisma.user.findMany({
      where,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        firebasePhone: true,
        role: true,
        status: true,
        profileCompleted: true,
        lastSeenAt: true,
        createdAt: true,
        profile: { select: { displayName: true, country: true, gender: true } },
        wallet: { select: { balance: true, negativeBalance: true } },
        strike: { select: { level: true } },
      },
    });
  }

  /**
   * Get detailed user info for admin detail page.
   * Includes: profile, wallet + last 10 transactions, last 10 calls, reports, strikes.
   */
  async getUserDetail(userId: string): Promise<unknown> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, firebasePhone: true, firebaseUid: true, role: true, status: true,
        profileCompleted: true, lastSeenAt: true, createdAt: true,
        profile: { select: { displayName: true, avatarUrl: true, bio: true, gender: true, country: true, birthYear: true } },
        wallet: { select: { id: true, balance: true, negativeBalance: true, version: true } },
        strike: { select: { level: true, lastStrikeAt: true, cooldownEndsAt: true, lastReason: true } },
        entitlement: { select: { status: true, expiresAt: true } },
        _count: {
          select: {
            callsAsCaller: true,
            callsAsCallee: true,
            reportsReceived: true,
            reportsMade: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const [transactions, calls] = await Promise.all([
      this.prisma.coinTransaction.findMany({
        where: { wallet: { userId } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, type: true, amount: true, balanceAfter: true, reference: true, createdAt: true },
      }),
      this.prisma.call.findMany({
        where: { OR: [{ callerId: userId }, { calleeId: userId }] },
        orderBy: { startedAt: 'desc' },
        take: 10,
        select: { id: true, status: true, startedAt: true, endedAt: true, durationSec: true, endReason: true, avgQualityMs: true },
      }),
    ]);

    return { ...user, transactions, calls };
  }

  /**
   * Adjust coins — admin adds or removes coins from a user's wallet.
   * ZORUNLU açıklama notu — if note is empty, throws BadRequestException.
   *
   * Flow:
   *   1. Validate note is non-empty (mandatory).
   *   2. WalletService.credit (positive delta) or debit (negative delta).
   *      Type = ADJUSTMENT. idempotencyKey = `adjust_<userId>_<timestamp>`.
   *   3. AuditLog write: action=COIN_ADJUST, targetId=userId, payload={ delta, note, newBalance }.
   *
   * Returns the new balance + transaction id.
   */
  async adjustCoins(opts: {
    userId: string;
    adminUserId: string;
    delta: number; // positive = credit, negative = debit
    note: string; // MANDATORY
    ip: string;
  }): Promise<{ txId: string; newBalance: number }> {
    if (!opts.note || opts.note.trim().length < 3) {
      throw new BadRequestException('Mandatory note required (min 3 chars)');
    }
    if (opts.delta === 0) {
      throw new BadRequestException('Delta must be non-zero');
    }

    let result: { txId: string; newBalance: number };
    if (opts.delta > 0) {
      result = await this.wallet.credit({
        userId: opts.userId,
        amount: opts.delta,
        type: CoinTxType.ADJUSTMENT,
        idempotencyKey: `adjust_${opts.userId}_${Date.now()}`,
        reference: `admin:${opts.adminUserId}`,
      });
    } else {
      result = await this.wallet.debit({
        userId: opts.userId,
        amount: Math.abs(opts.delta),
        type: CoinTxType.ADJUSTMENT,
        idempotencyKey: `adjust_${opts.userId}_${Date.now()}`,
        reference: `admin:${opts.adminUserId}`,
      });
    }

    // AuditLog — mandatory for every coin adjustment.
    await this.prisma.auditLog.create({
      data: {
        adminUserId: opts.adminUserId,
        action: 'COIN_ADJUST',
        targetType: 'User',
        targetId: opts.userId,
        payload: {
          delta: opts.delta,
          note: opts.note,
          newBalance: result.newBalance,
        } as never,
        ip: opts.ip,
      },
    });

    this.logger.log(
      `💰 Admin ${opts.adminUserId} adjusted ${opts.delta} coins for ${opts.userId} (note: "${opts.note}") → balance ${result.newBalance}`,
    );
    return result;
  }

  // ─── FCM broadcast (stub — real FCM integration is Phase 11) ────────

  async broadcastFcm(opts: {
    adminUserId: string;
    title: string;
    body: string;
    target: 'all' | 'vip' | { country: string };
    ip: string;
  }): Promise<{ sent: number }> {
    // Phase 10 stub — in production this calls firebase-admin.messaging.sendMulticast
    // with the target filter. For now, just count devices.
    const where =
      opts.target === 'all'
        ? {}
        : opts.target === 'vip'
        ? { entitlement: { status: 'ACTIVE' } }
        : { profile: { country: (opts.target as { country: string }).country } };

    const deviceCount = await this.prisma.device.count({ where: { user: where } });

    await this.prisma.auditLog.create({
      data: {
        adminUserId: opts.adminUserId,
        action: 'BROADCAST_FCM',
        targetType: 'Device',
        targetId: 'broadcast',
        payload: { title: opts.title, body: opts.body, target: opts.target, deviceCount } as never,
        ip: opts.ip,
      },
    });

    this.logger.log(
      `📢 Admin ${opts.adminUserId} broadcast FCM "${opts.title}" → ${deviceCount} devices (${JSON.stringify(opts.target)})`,
    );
    return { sent: deviceCount };
  }

  // ─── Audit log viewer ─────────────────────────────────────────────────

  async getAuditLog(take = 50, cursor?: string): Promise<{ items: unknown[]; nextCursor: string | null }> {
    const rows = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        adminUser: { select: { email: true, role: true } },
      },
    });
    const nextCursor = rows.length > take ? rows.pop()!.id : null;
    return { items: rows, nextCursor };
  }
}
