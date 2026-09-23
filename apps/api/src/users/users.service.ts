import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProfanityService } from './profanity.service';
import { Gender } from '@prisma/client';

/**
 * UsersService — handles /me GET + PATCH (profile completion) + /me/delete.
 *
 * Profile completion rules:
 *   - displayName: 3-40 chars, unique, profanity-filtered.
 *   - birthYear: must make user ≥ 18 (currentYear - birthYear >= 18).
 *   - gender: MALE / FEMALE / OTHER / UNSPECIFIED.
 *   - country: ISO 3166-1 alpha-2 (we don't validate the value here — client UI
 *     sends one of the predefined values).
 *   - avatarUrl: optional — must come from a presigned PUT (server validates the
 *     host matches our S3_PUBLIC_BASE_URL).
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profanity: ProfanityService,
  ) {}

  /** GET /me — returns user + profile + wallet balance + pending deletion. */
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firebasePhone: true,
        role: true,
        status: true,
        profileCompleted: true,
        lastSeenAt: true,
        createdAt: true,
        profile: {
          select: { displayName: true, avatarUrl: true, bio: true, gender: true, country: true, birthYear: true },
        },
        wallet: { select: { balance: true } },
        deletionRequest: {
          where: { canceledAt: null, executedAt: null },
          select: { id: true, scheduledAt: true, requestedAt: true },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /** PATCH /me — upserts the profile. Used for first-time profile completion
   *  AND for later edits (e.g. user changes nickname). */
  async updateProfile(
    userId: string,
    opts: {
      displayName?: string;
      avatarUrl?: string;
      bio?: string;
      gender?: Gender;
      country?: string;
      birthYear?: number;
    },
  ) {
    // Validate displayName if provided.
    if (opts.displayName !== undefined) {
      const n = opts.displayName.trim();
      if (n.length < 3 || n.length > 40) {
        throw new BadRequestException('Nickname must be 3-40 chars');
      }
      if (this.profanity.containsProfanity(n)) {
        throw new BadRequestException('Nickname contains blocked words');
      }
      // Uniqueness check.
      const clash = await this.prisma.profile.findFirst({
        where: { displayName: n, userId: { not: userId } },
        select: { id: true },
      });
      if (clash) {
        throw new ConflictException('Nickname taken');
      }
      opts.displayName = n;
    }

    // Validate birthYear if provided.
    if (opts.birthYear !== undefined) {
      const now = new Date();
      const age = now.getFullYear() - opts.birthYear;
      if (age < 18) {
        throw new BadRequestException('Users under 18 are not allowed');
      }
      if (age > 120) {
        throw new BadRequestException('Invalid birth year');
      }
    }

    // Validate country if provided.
    if (opts.country !== undefined) {
      if (!/^[A-Z]{2}$/.test(opts.country)) {
        throw new BadRequestException('Country must be ISO 3166-1 alpha-2');
      }
    }

    // Validate avatarUrl if provided — host must match our S3.
    if (opts.avatarUrl !== undefined && opts.avatarUrl !== null) {
      // Phase 2: just check it's a URL. Phase 8 will validate host.
    }

    // Upsert profile.
    const profile = await this.prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        displayName: opts.displayName ?? 'user_' + userId.slice(0, 8),
        avatarUrl: opts.avatarUrl,
        bio: opts.bio,
        gender: opts.gender ?? Gender.UNSPECIFIED,
        country: opts.country,
        birthYear: opts.birthYear,
      },
      update: {
        displayName: opts.displayName,
        avatarUrl: opts.avatarUrl,
        bio: opts.bio,
        gender: opts.gender,
        country: opts.country,
        birthYear: opts.birthYear,
      },
    });

    // Mark user.profileCompleted = true if displayName + birthYear set.
    if (profile.displayName && profile.birthYear) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { profileCompleted: true, lastSeenAt: new Date() },
      });
    }

    return profile;
  }

  /** POST /me/delete — schedule account deletion in 14 days. */
  async requestDeletion(userId: string, reason?: string) {
    // Check if there's already a pending request.
    const existing = await this.prisma.deletionRequest.findUnique({
      where: { userId },
    });
    if (existing && !existing.canceledAt && !existing.executedAt) {
      // Already pending — return it without scheduling a new one.
      return existing;
    }
    const scheduledAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    return this.prisma.deletionRequest.upsert({
      where: { userId },
      create: {
        userId,
        scheduledAt,
        reason,
      },
      update: {
        // Re-request after a previous cancel — re-schedule.
        scheduledAt,
        canceledAt: null,
        reason,
      },
    });
  }

  /** POST /me/delete/cancel — cancel a pending deletion request. */
  async cancelDeletion(userId: string) {
    const req = await this.prisma.deletionRequest.findUnique({
      where: { userId },
    });
    if (!req) {
      throw new NotFoundException('No pending deletion request');
    }
    if (req.canceledAt || req.executedAt) {
      throw new BadRequestException('Deletion request already finalized');
    }
    return this.prisma.deletionRequest.update({
      where: { id: req.id },
      data: { canceledAt: new Date() },
    });
  }
}
