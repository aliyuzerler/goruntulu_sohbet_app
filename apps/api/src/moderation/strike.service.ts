import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UserStatus } from '@prisma/client';

/**
 * StrikeService — per-user moderation strike counter.
 *
 * Levels (configurable):
 *   1 → warning (call ends, user notified)
 *   2 → 24h cooldown (cannot match for STRIKE_COOLDOWN_HOURS)
 *   3+ → permanent ban (User.status = BANNED, auth rejected)
 *
 * Special case: MINOR (underage) report → instant ban + manual review.
 *   isUnderage=true in applyStrike → bypass level escalation, go straight to ban.
 *
 * Cooldown check: isCooldown(userId) returns true if level==2 AND cooldownEndsAt > now.
 * Banned check: isBanned(userId) returns true if level>=3 OR User.status==BANNED.
 */
@Injectable()
export class StrikeService {
  private readonly logger = new Logger(StrikeService.name);
  private readonly cooldownHours: number;
  private readonly banLevel: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.cooldownHours = config.get<number>('STRIKE_COOLDOWN_HOURS') ?? 24;
    this.banLevel = config.get<number>('STRIKE_BAN_LEVEL') ?? 3;
  }

  /**
   * Apply a strike to a user.
   *
   *   reason: short string for audit (e.g. "nsfw_frame", "user_report_minor", "manual_ban")
   *   isUnderage: if true → instant ban regardless of current level.
   *
   * Returns the new strike level + whether user is now banned.
   */
  async applyStrike(opts: {
    userId: string;
    reason: string;
    isUnderage?: boolean;
  }): Promise<{ level: number; banned: boolean; cooldownEndsAt: Date | null }> {
    const now = new Date();
    // Upsert the strike row.
    const existing = await this.prisma.strike.findUnique({
      where: { userId: opts.userId },
    });
    const currentLevel = existing?.level ?? 0;
    const newLevel = opts.isUnderage
      ? this.banLevel // Instant ban on underage suspicion.
      : Math.min(currentLevel + 1, this.banLevel);

    const cooldownEndsAt = newLevel === 2
      ? new Date(now.getTime() + this.cooldownHours * 60 * 60 * 1000)
      : null;

    const strike = await this.prisma.strike.upsert({
      where: { userId: opts.userId },
      create: {
        userId: opts.userId,
        level: newLevel,
        lastStrikeAt: now,
        cooldownEndsAt,
        lastReason: opts.reason,
      },
      update: {
        level: newLevel,
        lastStrikeAt: now,
        cooldownEndsAt,
        lastReason: opts.reason,
      },
    });

    // If new level >= ban level → set User.status = BANNED.
    let banned = false;
    if (newLevel >= this.banLevel || opts.isUnderage) {
      await this.prisma.user.update({
        where: { id: opts.userId },
        data: { status: UserStatus.BANNED },
      });
      banned = true;
      this.logger.warn(
        `✗ User ${opts.userId} BANNED (level ${newLevel}, reason ${opts.reason}${opts.isUnderage ? ', underage' : ''})`,
      );
    } else if (newLevel === 2) {
      this.logger.warn(
        `⚠ User ${opts.userId} cooldown ${this.cooldownHours}h (level 2, reason ${opts.reason})`,
      );
    } else {
      this.logger.log(
        `⚠ User ${opts.userId} warning (level 1, reason ${opts.reason})`,
      );
    }

    return { level: strike.level, banned, cooldownEndsAt: strike.cooldownEndsAt };
  }

  /** Is the user currently banned (level >= ban level OR status BANNED)? */
  async isBanned(userId: string): Promise<boolean> {
    const [strike, user] = await Promise.all([
      this.prisma.strike.findUnique({ where: { userId } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { status: true } }),
    ]);
    if (user?.status === UserStatus.BANNED) return true;
    return (strike?.level ?? 0) >= this.banLevel;
  }

  /** Is the user in a cooldown period (level == 2 AND cooldown not yet expired)? */
  async isCooldown(userId: string): Promise<{ inCooldown: boolean; endsAt?: Date }> {
    const strike = await this.prisma.strike.findUnique({ where: { userId } });
    if (!strike || strike.level !== 2 || !strike.cooldownEndsAt) {
      return { inCooldown: false };
    }
    if (strike.cooldownEndsAt.getTime() < Date.now()) {
      return { inCooldown: false };
    }
    return { inCooldown: true, endsAt: strike.cooldownEndsAt };
  }

  /**
   * Manual unban — admin overrides a ban.
   * Sets strike.level back to 1 + User.status = ACTIVE.
   */
  async unban(userId: string, adminUserId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.strike.upsert({
        where: { userId },
        create: { userId, level: 1, lastReason: 'unban' },
        update: { level: 1, cooldownEndsAt: null, lastReason: 'unban' },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { status: UserStatus.ACTIVE },
      }),
    ]);
    this.logger.log(`✓ User ${userId} unbanned by admin ${adminUserId}`);
  }
}
