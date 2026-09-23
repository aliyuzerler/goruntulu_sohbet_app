import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { AgoraService } from '../calls/agora.service';
import { WalletService } from '../wallet/wallet.service';
import { SpendService } from '../billing/spend.service';
import { EntitlementService } from '../vip/entitlement.service';
import { FiltersService } from '../filters/filters.service';
import { DailyQuotaService } from './daily-quota.service';
import { MATCH_ATOMIC_LUA } from './match-atomic.lua';
import { CallStatus } from '@prisma/client';
import { randomUUID } from 'crypto';

/**
 * MatchmakingService — Phase 5 (server-authoritative) matchmaking.
 *
 * Layout:
 *   Country queue: `match:queue:country:<country>` (sorted set, score=joinedAt)
 *   Global queue: `match:queue:global` (sorted set, score=demotedAt)
 *   Filters hash: `match:filters:<userId>` { genderFilters, countryFilters, joinedAt, country }
 *   Skip cooldown: `match:cooldown:<userId>` (string, TTL=3s)
 *   Skip counter: `match:skips:<userId>:<YYYY-MM-DD>` (INCR, expires at midnight)
 *
 * Flow on queue:join:
 *   1. Check cooldown — if recently skipped, reject with RATE_LIMITED.
 *   2. Check daily skip counter — if > MAX_CONSECUTIVE_SKIPS, timeout 30s.
 *   3. Check daily quota + balance via DailyQuotaService.
 *      - If can't (low_balance) → return that reason.
 *   4. Add to country queue with score=joinedAt.
 *   5. Trigger immediate match attempt.
 *
 * Demotion to global pool (every 5s):
 *   - Worker scans country queues for users older than 45s.
 *   - ZREM from country queue + ZADD to global queue.
 *   - Keeps original joinedAt score so oldest users match first.
 *
 * Match attempt (Lua script — atomic):
 *   - See match-atomic.lua.ts for the algorithm.
 *   - Returns partner id + which queue they came from.
 *
 * Post-match:
 *   1. Block check (Postgres query).
 *   2. If blocked → re-add user to queue (with delay), try next partner.
 *   3. Create Call row (status MATCHED).
 *   4. Generate Agora tokens for both publishers.
 *   5. If paid match → WalletService.debit (atomic) — failure here aborts.
 *   6. Increment daily quota counter.
 *   7. Stash pending match: emit match:found on next heartbeat.
 */
@Injectable()
export class MatchmakingService {
  private readonly logger = new Logger(MatchmakingService.name);
  private readonly redis: Redis;
  private readonly countryPriorityTtlSec: number;
  private readonly skipCooldownSec: number;
  private readonly maxConsecutiveSkips: number;
  private readonly skipTimeoutSec: number;
  private workerTimer: NodeJS.Timeout | null = null;
  private demotionTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly agora: AgoraService,
    private readonly wallet: WalletService,
    private readonly spend: SpendService,
    private readonly entitlement: EntitlementService,
    private readonly filters: FiltersService,
    private readonly quota: DailyQuotaService,
  ) {
    this.countryPriorityTtlSec = config.get<number>('COUNTRY_PRIORITY_TTL_SEC') ?? 45;
    this.skipCooldownSec = config.get<number>('MATCH_COOLDOWN_SEC') ?? 3;
    this.maxConsecutiveSkips = config.get<number>('MAX_CONSECUTIVE_SKIPS') ?? 5;
    this.skipTimeoutSec = config.get<number>('SKIP_TIMEOUT_SEC') ?? 30;
    this.redis = new Redis(config.get<string>('REDIS_URL')!, {
      connectTimeout: 1000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    this.redis.defineCommand('matchAtomic', {
      numberOfKeys: 2,
      lua: MATCH_ATOMIC_LUA,
    });
    this.redis.connect().catch((e) => {
      this.logger.warn(`Redis connect failed (matchmaking): ${e.message}`);
    });
  }

  /**
   * User joins the queue. Validates cooldown + daily skip limit + quota.
   *
   * Returns a tagged result so the gateway can emit the right event:
   *   - ok + queued  → standard queue:joined with position
   *   - cooldown     → reject with RATE_LIMITED
   *   - skip_timeout → reject with skip timeout
   *   - low_balance  → reject with low_balance event
   */
  async joinQueue(opts: {
    userId: string;
    genderFilters?: string[];
    countryFilters?: string[];
  }): Promise<
    | { kind: 'ok'; position: number; charge: number; remainingFree: number }
    | { kind: 'cooldown'; retryAfterSec: number }
    | { kind: 'skip_timeout'; retryAfterSec: number }
    | { kind: 'low_balance'; needed: number; remainingFree: number }
  > {
    // 1. Cooldown check — was the user skipping recently?
    const cooldownKey = `match:cooldown:${opts.userId}`;
    const cooldownTtl = await this.redis.pttl(cooldownKey).catch(() => -2);
    if (cooldownTtl !== null && cooldownTtl > 0) {
      return {
        kind: 'cooldown',
        retryAfterSec: Math.ceil(cooldownTtl / 1000),
      };
    }

    // 2. Daily skip counter — if exceeded, timeout.
    const today = this.todayKey();
    const skipCount = parseInt(
      (await this.redis.get(`match:skips:${opts.userId}:${today}`).catch(() => '0')) ?? '0',
      10,
    );
    if (skipCount >= this.maxConsecutiveSkips) {
      return { kind: 'skip_timeout', retryAfterSec: this.skipTimeoutSec };
    }

    // 3. Look up user's country for the country-queue selection.
    const profile = await this.prisma.profile.findUnique({
      where: { userId: opts.userId },
      select: { country: true },
    });
    const country = (profile?.country ?? '??').toUpperCase().slice(0, 2);

    // 4. Quota + balance check.
    const balance = await this.wallet.getBalance(opts.userId);
    const canMatch = await this.quota.canMatchNow({ userId: opts.userId, currentBalance: balance });
    if (!canMatch.canMatch) {
      return {
        kind: 'low_balance',
        needed: canMatch.needed,
        remainingFree: canMatch.remainingFree,
      };
    }

    // 5. Add to country queue (atomic).
    const score = Date.now();
    const countryKey = `match:queue:country:${country}`;
    const globalKey = 'match:queue:global';
    const multi = this.redis.multi();
    multi.hset(`match:filters:${opts.userId}`, {
      genderFilters: JSON.stringify(opts.genderFilters ?? []),
      countryFilters: JSON.stringify(opts.countryFilters ?? []),
      country,
      joinedAt: String(score),
    });
    multi.expire(`match:filters:${opts.userId}`, 600);
    multi.zadd(countryKey, score, opts.userId);
    await multi.exec();

    // 6. Try to match immediately.
    await this.tryMatch(opts.userId, country);

    // 7. Position for UI display.
    const position = await this.redis.zrank(countryKey, opts.userId).catch(() => 0);
    return {
      kind: 'ok',
      position: (position ?? 0) + 1,
      charge: canMatch.charge,
      remainingFree: canMatch.remainingFree,
    };
  }

  /** User leaves the queue. Idempotent. */
  async leaveQueue(opts: { userId: string }): Promise<void> {
    const filters = await this.redis
      .hget(`match:filters:${opts.userId}`, 'country')
      .catch(() => null);
    const country = (filters ?? '??').toUpperCase().slice(0, 2);
    const countryKey = `match:queue:country:${country}`;
    const globalKey = 'match:queue:global';
    await this.redis
      .multi()
      .zrem(countryKey, opts.userId)
      .zrem(globalKey, opts.userId)
      .del(`match:filters:${opts.userId}`)
      .exec();
  }

  /**
   * User skipped a call (Next button) — record the skip and apply cooldown.
   * Increments the daily skip counter; if it exceeds MAX_CONSECUTIVE_SKIPS,
   * the next queue:join will be rejected with skip_timeout.
   */
  async recordSkip(opts: { userId: string; callId: string }): Promise<void> {
    const today = this.todayKey();
    const key = `match:skips:${opts.userId}:${today}`;
    const multi = this.redis.multi();
    multi.incr(key);
    multi.expireat(key, this.nextMidnightEpoch());
    multi.set(`match:cooldown:${opts.userId}`, '1', 'EX', this.skipCooldownSec);
    await multi.exec().catch((e) => {
      this.logger.warn(`Skip record failed: ${e.message}`);
    });
  }

  /**
   * Try to match `userId` with a partner — atomic Lua script.
   * On success: creates a Call row, debits coins (if paid match), stashes
   * the match for the gateway to emit.
   */
  private async tryMatch(userId: string, country: string): Promise<boolean> {
    const countryKey = `match:queue:country:${country}`;
    const globalKey = 'match:queue:global';

    // Atomic Lua — returns [partnerId, sourceQueue] or null.
    const result = (await (this.redis as unknown as {
      matchAtomic: (k1: string, k2: string, arg: string) => Promise<string[] | null>;
    }).matchAtomic(countryKey, globalKey, userId).catch((e: Error) => {
      this.logger.warn(`Lua matchAtomic failed: ${e.message}`);
      return null;
    })) as string[] | null;

    if (!result || result.length < 1 || !result[0]) return false;
    const partnerId = result[0];

    // Block check (Postgres) — if blocked pair, re-add user to queue + try next.
    const blocks = await this.prisma.block.findMany({
      where: {
        OR: [
          { blockerId: userId, blockedId: partnerId },
          { blockerId: partnerId, blockedId: userId },
        ],
      },
      select: { id: true },
    });
    if (blocks.length > 0) {
      // Re-add user to queue — they'll match with someone else next tick.
      const filters = await this.redis.hget(`match:filters:${userId}`, 'joinedAt').catch(() => String(Date.now()));
      const score = parseInt(filters ?? String(Date.now()), 10);
      await this.redis.zadd(countryKey, score, userId).catch(() => {});
      this.logger.debug(`Blocked pair skipped: ${userId} ↔ ${partnerId}`);
      return false;
    }

    // Phase 7: Filter compatibility check with gradual relaxation.
    //   - If either side's gender filter doesn't allow the other AND the user
    //     has waited < FAIRNESS_RELAX_GENDER_SEC → reject (re-queue).
    //   - If either side's country filter doesn't allow the other AND the user
    //     has waited < FAIRNESS_RELAX_COUNTRY_SEC → reject (re-queue).
    //   - After the relaxation threshold, filter is ignored — nobody waits forever.
    //
    // Gender filter is VIP-gated: only VIP users have it active. Non-VIP
    // users have an "any gender" preference.
    const scoreRaw = await this.redis.hget(`match:filters:${userId}`, 'joinedAt').catch(() => String(Date.now()));
    const score = parseInt(scoreRaw ?? String(Date.now()), 10);
    const filterCheck = await this.checkFilterCompatibility(userId, partnerId, score);
    if (!filterCheck.compatible) {
      // Re-add user to queue with original score.
      await this.redis.zadd(countryKey, score, userId).catch(() => {});
      this.logger.debug(
        `Filter mismatch (${filterCheck.reason}) — re-queued ${userId} ↔ ${partnerId}`,
      );
      return false;
    }

    // Create Call row.
    const callId = randomUUID();
    const agoraChannel = this.agora.channelForCall(callId);
    await this.prisma.call.create({
      data: {
        id: callId,
        callerId: userId,
        calleeId: partnerId,
        agoraChannel,
        status: CallStatus.MATCHED,
      },
    });

    // Quota + wallet debit (if paid match).
    const balance = await this.wallet.getBalance(userId);
    const canMatch = await this.quota.canMatchNow({ userId, currentBalance: balance });
    if (!canMatch.canMatch) {
      // Edge case: quota changed between joinQueue and tryMatch.
      // Undo the match — end the call with reason=low_balance.
      await this.prisma.call.update({
        where: { id: callId },
        data: {
          status: CallStatus.ENDED,
          endedAt: new Date(),
          durationSec: 0,
          endReason: 'low_balance',
        },
      });
      this._pendingMatches.set(userId, {
        callId,
        agoraChannel,
        peer: { id: '', displayName: '—' },
        role: 'caller',
        lowBalance: { needed: canMatch.needed, remainingFree: canMatch.remainingFree },
      });
      return true;
    }
    if (canMatch.charge > 0) {
      // Phase 6: atomic spend via SpendService (wraps WalletService.debit
      // with proper CoinTxType + idempotencyKey + reference).
      try {
        await this.spend.spendMatch({
          userId,
          callId,
          amount: canMatch.charge,
        });
      } catch (e) {
        // Insufficient balance race — undo the match.
        await this.prisma.call.update({
          where: { id: callId },
          data: {
            status: CallStatus.ENDED,
            endedAt: new Date(),
            durationSec: 0,
            endReason: 'low_balance',
          },
        });
        return false;
      }
    }
    // Also debit the partner if they're past their free quota.
    const partnerBalance = await this.wallet.getBalance(partnerId);
    const partnerCan = await this.quota.canMatchNow({
      userId: partnerId,
      currentBalance: partnerBalance,
    });
    if (partnerCan.canMatch && partnerCan.charge > 0) {
      try {
        await this.spend.spendMatch({
          userId: partnerId,
          callId,
          amount: partnerCan.charge,
        });
      } catch (_) {
        // Partner debit failed — they get the match for free this time.
      }
    }

    // Increment daily quotas for both.
    await this.quota.recordMatch(userId);
    await this.quota.recordMatch(partnerId);

    // Fetch profiles for the match:found envelope.
    const [caller, callee] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, profile: { select: { displayName: true, avatarUrl: true, country: true, gender: true } } },
      }),
      this.prisma.user.findUnique({
        where: { id: partnerId },
        select: { id: true, profile: { select: { displayName: true, avatarUrl: true, country: true, gender: true } } },
      }),
    ]);

    const callerUid = this.agora.userUuidToUid(userId);
    const calleeUid = this.agora.userUuidToUid(partnerId);
    const callerToken = this.agora.generateToken({ channelName: agoraChannel, uid: callerUid });
    const calleeToken = this.agora.generateToken({ channelName: agoraChannel, uid: calleeUid });

    this._pendingMatches.set(userId, {
      callId,
      agoraChannel,
      agoraToken: callerToken,
      peer: {
        id: partnerId,
        displayName: callee?.profile?.displayName ?? 'Anon',
        avatarUrl: callee?.profile?.avatarUrl,
        country: callee?.profile?.country,
        gender: callee?.profile?.gender,
      },
      role: 'caller',
    });
    this._pendingMatches.set(partnerId, {
      callId,
      agoraChannel,
      agoraToken: calleeToken,
      peer: {
        id: userId,
        displayName: caller?.profile?.displayName ?? 'Anon',
        avatarUrl: caller?.profile?.avatarUrl,
        country: caller?.profile?.country,
        gender: caller?.profile?.gender,
      },
      role: 'callee',
    });

    this.logger.log(`✓ Matched ${userId} ↔ ${partnerId} → call ${callId}`);
    return true;
  }

  /** In-memory pending matches — drained by gateway on heartbeat. */
  private readonly _pendingMatches = new Map<string, PendingMatch>();

  drainPendingMatch(userId: string): PendingMatch | null {
    const m = this._pendingMatches.get(userId);
    if (m) this._pendingMatches.delete(userId);
    return m ?? null;
  }

  startWorker() {
    if (this.workerTimer) return;
    this.workerTimer = setInterval(() => void this.tick(), 1000);
    this.demotionTimer = setInterval(() => void this.demoteOldUsers(), 5000);
    this.logger.log('✓ Matchmaking worker started (Lua atomic + 45s demotion)');
  }

  stopWorker() {
    if (this.workerTimer) {
      clearInterval(this.workerTimer);
      this.workerTimer = null;
    }
    if (this.demotionTimer) {
      clearInterval(this.demotionTimer);
      this.demotionTimer = null;
    }
  }

  /** Worker tick — try to match every queued user. */
  private async tick(): Promise<void> {
    try {
      // For each user in any country queue, attempt match.
      const countryQueues = await this.scanKeys('match:queue:country:*');
      const allUsers = new Set<string>();
      for (const q of countryQueues) {
        const users = await this.redis.zrange(q, 0, -1);
        for (const u of users) allUsers.add(u);
      }
      // Also include global queue users.
      const globalUsers = await this.redis.zrange('match:queue:global', 0, -1).catch(() => []);
      for (const u of globalUsers) allUsers.add(u);
      for (const userId of allUsers) {
        if (this._pendingMatches.has(userId)) continue;
        const country = await this.redis
          .hget(`match:filters:${userId}`, 'country')
          .catch(() => '??');
        await this.tryMatch(userId, country ?? '??');
      }
    } catch (e) {
      this.logger.warn(`Matchmaking tick failed: ${(e as Error).message}`);
    }
  }

  /**
   * Demote users who've been in a country queue for > COUNTRY_PRIORITY_TTL_SEC.
   * ZREM from country queue, ZADD to global queue (keeping the original score
   * so they're still matched in age order).
   */
  private async demoteOldUsers(): Promise<void> {
    try {
      const now = Date.now();
      const cutoff = now - this.countryPriorityTtlSec * 1000;
      const countryQueues = await this.scanKeys('match:queue:country:*');
      for (const q of countryQueues) {
        // Users older than the cutoff — by score.
        const users = await this.redis.zrangebyscore(q, '-inf', `(${String(cutoff)}`);
        if (users.length === 0) continue;
        const multi = this.redis.multi();
        for (const u of users) {
          multi.zrem(q, u);
          // Get the user's original score so we keep order in the global queue.
          // We stored joinedAt in match:filters hash.
          const f = await this.redis.hget(`match:filters:${u}`, 'joinedAt').catch(() => String(now));
          multi.zadd('match:queue:global', parseInt(f ?? String(now), 10), u);
        }
        await multi.exec();
      }
    } catch (e) {
      this.logger.warn(`Demotion tick failed: ${(e as Error).message}`);
    }
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    const out: string[] = [];
    let cursor = '0';
    do {
      const [next, batch] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      out.push(...batch);
    } while (cursor !== '0');
    return out;
  }

  /**
   * Phase 7: Filter compatibility check with gradual relaxation.
   *
   * Gender filter is VIP-only — non-VIP users have NO gender preference (always compatible).
   * VIP users with genderFilters = [FEMALE] will only match with FEMALE partners.
   *
   * Country filter is paid/VIP — non-VIP users without a paid activation have NO country preference.
   *
   * Gradual relaxation:
   *   - If user has waited < FAIRNESS_RELAX_COUNTRY_SEC (default 15s) → country filter enforced
   *   - If user has waited < FAIRNESS_RELAX_GENDER_SEC (default 30s) → gender filter enforced
   *   - After thresholds, filter ignored (nobody waits forever)
   *
   * Symmetric: both sides must pass (A's filter must allow B AND B's filter must allow A).
   */
  private async checkFilterCompatibility(
    userIdA: string,
    userIdB: string,
    scoreA: number,
  ): Promise<{ compatible: boolean; reason?: string }> {
    const waitSecA = Math.floor((Date.now() - scoreA) / 1000);
    const relaxCountrySec = (this.config.get<number>('FAIRNESS_RELAX_COUNTRY_SEC') ?? 15);
    const relaxGenderSec = (this.config.get<number>('FAIRNESS_RELAX_GENDER_SEC') ?? 30);

    // Fetch both users' filters + profiles in parallel.
    const [filtersA, filtersB, profileA, profileB] = await Promise.all([
      this.filters.getActiveFilters(userIdA),
      this.filters.getActiveFilters(userIdB),
      this.prisma.profile.findUnique({ where: { userId: userIdA }, select: { gender: true, country: true } }),
      this.prisma.profile.findUnique({ where: { userId: userIdB }, select: { gender: true, country: true } }),
    ]);

    // Score B's wait time for symmetric relaxation.
    const scoreBRaw = await this.redis.hget(`match:filters:${userIdB}`, 'joinedAt').catch(() => String(Date.now()));
    const scoreB = parseInt(scoreBRaw ?? String(Date.now()), 10);
    const waitSecB = Math.floor((Date.now() - scoreB) / 1000);

    // Country filter — only enforced if user has waited < relaxCountrySec AND
    // has an active country filter.
    if (waitSecA < relaxCountrySec && filtersA.country) {
      // A wants country=<filtersA.country>. B must be from that country.
      if (profileB?.country !== filtersA.country) {
        return { compatible: false, reason: 'country_a_filter' };
      }
    }
    if (waitSecB < relaxCountrySec && filtersB.country) {
      if (profileA?.country !== filtersB.country) {
        return { compatible: false, reason: 'country_b_filter' };
      }
    }

    // Gender filter — VIP-only. Enforced if user has waited < relaxGenderSec
    // AND user is VIP (genderAllowed=true) AND they sent genderFilters.
    // Phase 7: we read the stored genderFilters from Redis hash.
    const filtersAStored = await this.redis
      .hget(`match:filters:${userIdA}`, 'genderFilters')
      .catch(() => '[]');
    const filtersBStored = await this.redis
      .hget(`match:filters:${userIdB}`, 'genderFilters')
      .catch(() => '[]');
    let aGenders: string[] = [];
    let bGenders: string[] = [];
    try {
      aGenders = JSON.parse(filtersAStored ?? '[]');
      bGenders = JSON.parse(filtersBStored ?? '[]');
    } catch {
      // malformed — treat as no filter.
    }

    if (waitSecA < relaxGenderSec && filtersA.genderAllowed && aGenders.length > 0) {
      if (profileB && !aGenders.includes(profileB.gender)) {
        return { compatible: false, reason: 'gender_a_filter' };
      }
    }
    if (waitSecB < relaxGenderSec && filtersB.genderAllowed && bGenders.length > 0) {
      if (profileA && !bGenders.includes(profileA.gender)) {
        return { compatible: false, reason: 'gender_b_filter' };
      }
    }

    return { compatible: true };
  }

  private todayKey(): string {
    const d = new Date();
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private nextMidnightEpoch(): number {
    const d = new Date();
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0));
    return Math.floor(next.getTime() / 1000);
  }
}

/** Mirrors MatchmakingEventRegistry.match:found + low_balance variant. */
export interface PendingMatch {
  callId: string;
  agoraChannel: string;
  agoraToken?: string;
  peer: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    country?: string | null;
    gender?: string;
  };
  role: 'caller' | 'callee';
  lowBalance?: { needed: number; remainingFree: number };
}
