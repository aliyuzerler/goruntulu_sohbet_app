import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { SpendService } from '../billing/spend.service';
import { CoinTxType } from '@prisma/client';
import { randomBytes } from 'crypto';

/**
 * RetentionService — Phase 11 retention + monetization extras.
 *
 * All coin earnings go through WalletService.credit (creates CoinTransaction
 * ledger rows with idempotency keys). All coin spendings go through SpendService.
 *
 * Features:
 *   1. Daily login reward — 7-day streak with increasing rewards (1,2,3,4,5,5,5).
 *   2. Referral — invite code; on invitee's first purchase, both sides get bonus coins.
 *   3. Rewarded AdMob — watch ad → 1 coin, 3x daily (Redis counter + remote config flag).
 *   4. In-call gift — caller sends coins to callee (SpendService + WalletService.credit).
 *   5. Reconnect — pay coins to request a call with last matched user.
 *   6. Re-engagement push — 3-day inactive → FCM (stub; Phase 12 wires real FCM).
 */
@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);
  private readonly redis: Redis;
  private readonly dailyRewards: number[];
  private readonly adRewardCoins: number;
  private readonly adRewardDailyLimit: number;
  private readonly referralBonus: number;
  private readonly reconnectCost: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly spend: SpendService,
    config: ConfigService,
  ) {
    this.dailyRewards = (config.get<string>('DAILY_LOGIN_REWARDS') ?? '1,2,3,4,5,5,5')
      .split(',')
      .map((n) => parseInt(n.trim(), 10) || 0);
    this.adRewardCoins = config.get<number>('AD_REWARD_COINS') ?? 1;
    this.adRewardDailyLimit = config.get<number>('AD_REWARD_DAILY_LIMIT') ?? 3;
    this.referralBonus = config.get<number>('REFERRAL_BONUS_COINS') ?? 10;
    this.reconnectCost = config.get<number>('RECONNECT_COST_COINS') ?? 5;
    this.redis = new Redis(config.get<string>('REDIS_URL')!, {
      connectTimeout: 1000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    this.redis.connect().catch((e) => {
      this.logger.warn(`Redis connect failed (retention): ${e.message}`);
    });
  }

  // ─── 1. Daily login reward ──────────────────────────────────────────

  /**
   * Claim the daily login reward.
   *   - If already claimed today → return "already_claimed" with current streak.
   *   - If yesterday's claim exists → increment streak (cap at 7).
   *   - If gap > 1 day → reset streak to 1.
   *   - Credit coins via WalletService.credit (PURCHASE type — daily login is a free credit).
   *     Wait — should be ADJUSTMENT? No, daily login is a reward credit. Use PURCHASE
   *     since it's a free credit from the platform (like a promo).
   *     Actually the spec says "ledger'dan geçer" — any CoinTxType works as long as
   *     a CoinTransaction row is created. We use ADJUSTMENT with reference="daily_login_day_N".
   */
  async claimDailyLogin(userId: string): Promise<{
    streak: number;
    coinsEarned: number;
    newBalance: number;
    alreadyClaimed: boolean;
    tomorrowReward: number;
  }> {
    const today = this.todayKey();
    const yesterday = this.yesterdayKey();

    const existing = await this.prisma.dailyLoginStreak.findUnique({ where: { userId } });

    // Already claimed today?
    if (existing?.lastClaimDate === today) {
      return {
        streak: existing.currentStreak,
        coinsEarned: 0,
        newBalance: await this.wallet.getBalance(userId),
        alreadyClaimed: true,
        tomorrowReward: this.dailyRewards[Math.min(existing.currentStreak, this.dailyRewards.length - 1)],
      };
    }

    // Compute new streak.
    let newStreak = 1;
    if (existing?.lastClaimDate === yesterday) {
      // Consecutive day → increment (cap at 7).
      newStreak = Math.min(existing.currentStreak + 1, 7);
    } else if (existing) {
      // Gap → reset.
      newStreak = 1;
    }

    // Reward for this day (index = streak - 1, capped).
    const rewardIndex = Math.min(newStreak - 1, this.dailyRewards.length - 1);
    const coins = this.dailyRewards[rewardIndex] ?? 1;

    // Credit via WalletService (ledger entry with idempotency key).
    const credit = await this.wallet.credit({
      userId,
      amount: coins,
      type: CoinTxType.ADJUSTMENT,
      idempotencyKey: `daily_login_${userId}_${today}`,
      reference: `daily_login_day_${newStreak}`,
    });

    // Upsert streak row.
    await this.prisma.dailyLoginStreak.upsert({
      where: { userId },
      create: {
        userId,
        currentStreak: newStreak,
        totalEarned: (existing?.totalEarned ?? 0) + coins,
        lastClaimDate: today,
        lastClaimAt: new Date(),
      },
      update: {
        currentStreak: newStreak,
        totalEarned: { increment: coins },
        lastClaimDate: today,
        lastClaimAt: new Date(),
      },
    });

    // Tomorrow's reward (preview for UI).
    const tomorrowStreak = Math.min(newStreak + 1, 7);
    const tomorrowReward = this.dailyRewards[Math.min(tomorrowStreak - 1, this.dailyRewards.length - 1)] ?? 5;

    this.logger.log(`🎁 Daily login: user ${userId} day ${newStreak} → +${coins} coins (balance ${credit.newBalance})`);
    return {
      streak: newStreak,
      coinsEarned: coins,
      newBalance: credit.newBalance,
      alreadyClaimed: false,
      tomorrowReward,
    };
  }

  /** Get daily login status for UI (streak + last claim + tomorrow's reward). */
  async getDailyStatus(userId: string): Promise<{
    streak: number;
    totalEarned: number;
    lastClaimDate: string | null;
    canClaimToday: boolean;
    tomorrowReward: number;
  }> {
    const today = this.todayKey();
    const streak = await this.prisma.dailyLoginStreak.findUnique({ where: { userId } });
    const currentStreak = streak?.currentStreak ?? 0;
    const canClaim = streak?.lastClaimDate !== today;
    const nextStreak = canClaim
      ? (streak?.lastClaimDate === this.yesterdayKey() ? Math.min(currentStreak + 1, 7) : 1)
      : Math.min(currentStreak + 1, 7);
    const tomorrowReward = this.dailyRewards[Math.min(nextStreak - 1, this.dailyRewards.length - 1)] ?? 5;
    return {
      streak: currentStreak,
      totalEarned: streak?.totalEarned ?? 0,
      lastClaimDate: streak?.lastClaimDate ?? null,
      canClaimToday: canClaim,
      tomorrowReward,
    };
  }

  // ─── 2. Referral ─────────────────────────────────────────────────────

  /**
   * Create a referral — the invitee enters the invite code on signup.
   * The referrer is looked up by inviteCode.
   * Status = PENDING until the invitee makes their first purchase.
   */
  async createReferral(opts: { inviteeId: string; inviteCode: string }): Promise<{ referrerId: string; status: string }> {
    const referral = await this.prisma.referral.findUnique({
      where: { inviteCode: opts.inviteCode },
      include: { referrer: { select: { id: true } } },
    });
    if (!referral) throw new NotFoundException('Invalid invite code');
    if (referral.inviteeId && referral.inviteeId !== opts.inviteeId) {
      throw new BadRequestException('Invite code already used by another user');
    }

    // Update the referral row with the invitee.
    await this.prisma.referral.update({
      where: { id: referral.id },
      data: { inviteeId: opts.inviteeId },
    });

    this.logger.log(`👥 Referral created: ${referral.referrerId} → ${opts.inviteeId} (code ${opts.inviteCode})`);
    return { referrerId: referral.referrerId, status: 'PENDING' };
  }

  /**
   * Generate a unique invite code for a user (if they don't have one yet).
   * 6-char alphanumeric (excludes confusable chars: 0/O, 1/I/l).
   */
  async getOrCreateInviteCode(userId: string): Promise<{ inviteCode: string }> {
    const existing = await this.prisma.referral.findFirst({
      where: { referrerId: userId },
      select: { inviteCode: true },
    });
    if (existing) return { inviteCode: existing.inviteCode };

    const code = this.generateInviteCode();
    await this.prisma.referral.create({
      data: {
        referrerId: userId,
        inviteeId: userId, // Placeholder — updated when someone uses the code.
        inviteCode: code,
        status: 'PENDING',
      },
    });
    return { inviteCode: code };
  }

  /**
   * Called by BillingService when a purchase is verified — checks if this is
   * the invitee's first purchase, and if so, credits both sides.
   */
  async processReferralOnPurchase(opts: { userId: string; orderId: string }): Promise<{ bonusCredited: boolean }> {
    const referral = await this.prisma.referral.findFirst({
      where: { inviteeId: opts.userId, status: 'PENDING' },
    });
    if (!referral || referral.bonusCredited) return { bonusCredited: false };

    // Credit both referrer + invitee.
    await Promise.all([
      this.wallet.credit({
        userId: referral.referrerId,
        amount: this.referralBonus,
        type: CoinTxType.ADJUSTMENT,
        idempotencyKey: `referral_referrer_${referral.id}_${opts.orderId}`,
        reference: `referral_bonus_referrer`,
      }),
      this.wallet.credit({
        userId: opts.userId,
        amount: this.referralBonus,
        type: CoinTxType.ADJUSTMENT,
        idempotencyKey: `referral_invitee_${referral.id}_${opts.orderId}`,
        reference: `referral_bonus_invitee`,
      }),
    ]);

    await this.prisma.referral.update({
      where: { id: referral.id },
      data: { status: 'COMPLETED', bonusCredited: true, completedAt: new Date() },
    });

    this.logger.log(`👥 Referral completed: ${referral.referrerId} + ${opts.userId} → +${this.referralBonus} each`);
    return { bonusCredited: true };
  }

  // ─── 3. Rewarded AdMob ───────────────────────────────────────────────

  /**
   * Grant a coin for watching a rewarded ad.
   *   - Max 3 times per day (Redis counter, EXPIREAT midnight).
   *   - Remote config flag `ad_reward_enabled` can disable this feature.
   *   - Credit via WalletService.credit (ADJUSTMENT type, reference="ad_reward").
   */
  async grantAdReward(userId: string): Promise<{
    granted: boolean;
    coinsEarned: number;
    newBalance: number;
    remainingToday: number;
    reason?: string;
  }> {
    // Check remote config flag (via Redis — Phase 9 RemoteConfigService).
    const flagEnabled = await this.redis.get('remote-config:ad_reward_enabled').catch(() => 'true');
    if (flagEnabled === 'false') {
      return { granted: false, coinsEarned: 0, newBalance: await this.wallet.getBalance(userId), remainingToday: 0, reason: 'feature_disabled' };
    }

    const today = this.todayKey();
    const key = `ad-reward:${userId}:${today}`;
    const count = parseInt((await this.redis.get(key)) ?? '0', 10);
    if (count >= this.adRewardDailyLimit) {
      return { granted: false, coinsEarned: 0, newBalance: await this.wallet.getBalance(userId), remainingToday: 0, reason: 'daily_limit_reached' };
    }

    // Credit.
    const credit = await this.wallet.credit({
      userId,
      amount: this.adRewardCoins,
      type: CoinTxType.ADJUSTMENT,
      idempotencyKey: `ad_reward_${userId}_${today}_${count + 1}`,
      reference: 'ad_reward',
    });

    // Increment daily counter.
    const p = this.redis.multi();
    p.incr(key);
    p.expireat(key, this.nextMidnightEpoch());
    await p.exec().catch(() => {});

    const remainingToday = Math.max(0, this.adRewardDailyLimit - count - 1);
    this.logger.log(`📺 Ad reward: user ${userId} → +${this.adRewardCoins} coin (${count + 1}/${this.adRewardDailyLimit} today)`);
    return { granted: true, coinsEarned: this.adRewardCoins, newBalance: credit.newBalance, remainingToday };
  }

  // ─── 4. In-call gift ─────────────────────────────────────────────────

  /**
   * Send a coin gift during a call.
   *   - Sender's coins are debited (SpendService.spendGift).
   *   - Recipient's coins are credited (WalletService.credit).
   *   - Both are ledger entries (CoinTransaction rows).
   *   - Idempotency: gift_<callId>_<senderId>_<recipientId> for debit,
   *     gift_recv_<callId>_<senderId>_<recipientId> for credit.
   */
  async sendGift(opts: {
    senderId: string;
    recipientId: string;
    callId: string;
    amount: number;
  }): Promise<{ senderNewBalance: number; recipientNewBalance: number; giftId: string }> {
    if (opts.amount <= 0 || opts.amount > 100) {
      throw new BadRequestException('Gift amount must be 1-100');
    }
    if (opts.senderId === opts.recipientId) {
      throw new BadRequestException('Cannot gift yourself');
    }

    // Debit sender.
    const debit = await this.spend.spendGift({
      userId: opts.senderId,
      recipientId: opts.recipientId,
      amount: opts.amount,
      giftId: opts.callId,
    });

    // Credit recipient.
    const credit = await this.wallet.credit({
      userId: opts.recipientId,
      amount: opts.amount,
      type: CoinTxType.ADJUSTMENT,
      idempotencyKey: `gift_recv_${opts.callId}_${opts.senderId}_${opts.recipientId}`,
      reference: `gift_from_${opts.senderId}`,
    });

    this.logger.log(`🎁 Gift: ${opts.senderId} → ${opts.recipientId} ${opts.amount} coins (call ${opts.callId})`);
    return {
      senderNewBalance: debit.newBalance,
      recipientNewBalance: credit.newBalance,
      giftId: opts.callId,
    };
  }

  // ─── 5. Reconnect ────────────────────────────────────────────────────

  /**
   * Request a reconnect with the last matched user.
   *   - Debit RECONNECT_COST_COINS from the requester.
   *   - Emit a socket event `reconnect:request` to the last match's socket.
   *   - The recipient gets a push notification + in-app banner.
   *   - If the recipient accepts → a new Call row is created (Phase 4 flow).
   */
  async requestReconnect(opts: {
    userId: string;
    lastCallId: string;
  }): Promise<{ requested: boolean; peerId: string; cost: number; newBalance: number; reason?: string }> {
    // Find the last call.
    const call = await this.prisma.call.findUnique({
      where: { id: opts.lastCallId },
      select: { callerId: true, calleeId: true, status: true },
    });
    if (!call) throw new NotFoundException('Call not found');
    const peerId = call.callerId === opts.userId ? call.calleeId : call.callerId;

    // Debit the cost.
    const debit = await this.spend.spendFilter({
      userId: opts.userId,
      filterType: 'RECONNECT',
      amount: this.reconnectCost,
      filterId: `reconnect_${opts.lastCallId}_${Date.now()}`,
    });

    // Phase 11 stub: emit socket event to peer.
    // In production: this.socketGateway.sendToUser(peerId, 'reconnect:request', { from: opts.userId, callId: opts.lastCallId });
    this.logger.log(`🔄 Reconnect request: ${opts.userId} → ${peerId} (cost ${this.reconnectCost}, call ${opts.lastCallId})`);

    return {
      requested: true,
      peerId,
      cost: this.reconnectCost,
      newBalance: debit.newBalance,
    };
  }

  // ─── 6. Re-engagement push (stub) ────────────────────────────────────

  /**
   * Find users who haven't been seen in 3+ days + send a re-engagement push.
   * Phase 11 stub — Phase 12 will wire real FCM (firebase-admin.messaging).
   *
   * The push body includes the real online count (from PresenceService).
   */
  async sendReengagementPush(): Promise<{ sent: number }> {
    const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const inactiveUsers = await this.prisma.user.findMany({
      where: {
        lastSeenAt: { lt: cutoff },
        status: 'ACTIVE',
      },
      select: { id: true, devices: { select: { fcmToken: true } } },
      take: 100, // batch limit
    });

    let sent = 0;
    for (const user of inactiveUsers) {
      if (user.devices.length === 0) continue;
      // Phase 11 stub — in Phase 12:
      //   const onlineCount = await this.presence.getOnlineCount();
      //   await firebaseAdmin.messaging.sendMulticast({
      //     tokens: user.devices.map(d => d.fcmToken),
      //     notification: { title: 'Seni özledik!', body: `${onlineCount} kişi şu an çevrimiçi — gel sohbet edelim!` },
      //   });
      sent += user.devices.length;
    }

    this.logger.log(`📢 Re-engagement push: ${sent} tokens to ${inactiveUsers.length} inactive users (3+ days)`);
    return { sent };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  private generateInviteCode(): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/l
    const bytes = randomBytes(6);
    return Array.from(bytes, (b) => chars[b % chars.length]).join('');
  }

  private todayKey(): string {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }

  private yesterdayKey(): string {
    const d = new Date(Date.now() - 86400000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }

  private nextMidnightEpoch(): number {
    const d = new Date();
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0));
    return Math.floor(next.getTime() / 1000);
  }
}
