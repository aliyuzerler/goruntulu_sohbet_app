import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * RatingService — post-call 1-5 star ratings.
 *
 * Flow:
 *   1. After a call ends, the user is shown a rating sheet (30s timeout).
 *   2. User taps 1-5 stars → POST /api/moderation/rate.
 *   3. Server persists CallRating (callId, raterId, targetUserId, stars).
 *   4. Average rating per user is used by matchmaking to deprioritize
 *      low-rated users (e.g., avg < 2.5 → +30s queue penalty).
 *
 * Idempotency: (callId, raterId) is unique — duplicate rating requests
 * are no-ops (idempotent upsert).
 *
 * Phase 8 matchmaking integration: matchmaking reads getAverageRating(userId)
 * on queue:join — if avg < 2.5, the user gets a queue priority penalty.
 * (Phase 8 simple impl: the penalty is applied via the queue score —
 *  the user's score is artificially increased by 30s, putting them
 *  behind everyone else who joined around the same time.)
 */
@Injectable()
export class RatingService {
  private readonly logger = new Logger(RatingService.name);
  private readonly lowRatingThreshold = 2.5;
  private readonly lowRatingPenaltySec = 30;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Submit a rating for a call.
   *   stars: 1-5
   *   targetUserId: the OTHER participant (server validates they were in the call).
   */
  async submitRating(opts: {
    callId: string;
    raterId: string;
    targetUserId: string;
    stars: number;
  }): Promise<{ id: string; alreadyProcessed: boolean }> {
    if (opts.stars < 1 || opts.stars > 5) {
      throw new BadRequestException('stars must be 1-5');
    }
    // Validate the rater is a participant + targetUserId is the other side.
    const call = await this.prisma.call.findUnique({ where: { id: opts.callId } });
    if (!call) throw new BadRequestException('Call not found');
    if (call.callerId !== opts.raterId && call.calleeId !== opts.raterId) {
      throw new BadRequestException('Rater not a participant');
    }
    const expectedTarget = call.callerId === opts.raterId ? call.calleeId : call.callerId;
    if (expectedTarget !== opts.targetUserId) {
      throw new BadRequestException('Target is not the other participant');
    }

    // Idempotent upsert.
    const existing = await this.prisma.callRating.findUnique({
      where: { callId_raterId: { callId: opts.callId, raterId: opts.raterId } },
    });
    if (existing) {
      return { id: existing.id, alreadyProcessed: true };
    }
    const rating = await this.prisma.callRating.create({
      data: {
        callId: opts.callId,
        raterId: opts.raterId,
        targetUserId: opts.targetUserId,
        stars: Math.floor(opts.stars),
      },
    });
    this.logger.log(
      `⭐ ${opts.raterId} rated ${opts.targetUserId} ${opts.stars}★ (call ${opts.callId})`,
    );
    return { id: rating.id, alreadyProcessed: false };
  }

  /**
   * Get the average rating for a user (over their last N ratings).
   * Returns null if no ratings yet.
   */
  async getAverageRating(userId: string, sampleSize = 50): Promise<{ avg: number | null; count: number }> {
    const rows = await this.prisma.callRating.findMany({
      where: { targetUserId: userId },
      orderBy: { createdAt: 'desc' },
      take: sampleSize,
      select: { stars: true },
    });
    if (rows.length === 0) return { avg: null, count: 0 };
    const sum = rows.reduce((s, r) => s + r.stars, 0);
    return { avg: sum / rows.length, count: rows.length };
  }

  /** Should the user be deprioritized in the queue (avg < threshold)? */
  async shouldDeprioritize(userId: string): Promise<{ deprioritize: boolean; avg: number | null; penaltySec: number }> {
    const { avg } = await this.getAverageRating(userId);
    return {
      deprioritize: avg !== null && avg < this.lowRatingThreshold,
      avg,
      penaltySec: this.lowRatingPenaltySec,
    };
  }
}
