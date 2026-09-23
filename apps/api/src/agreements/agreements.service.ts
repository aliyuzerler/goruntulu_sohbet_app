import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgreementType } from '@prisma/client';

/**
 * AgreementsService — fetches the latest published version of each agreement
 * type, and records per-user acceptance with an immutable snapshot.
 */
@Injectable()
export class AgreementsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Get the latest published version of each agreement type. */
  async getLatest() {
    const [terms, privacy] = await Promise.all([
      this.prisma.agreement.findFirst({
        where: { type: AgreementType.TERMS, archivedAt: null },
        orderBy: { publishedAt: 'desc' },
      }),
      this.prisma.agreement.findFirst({
        where: { type: AgreementType.PRIVACY, archivedAt: null },
        orderBy: { publishedAt: 'desc' },
      }),
    ]);
    return { terms, privacy };
  }

  /** Get a single agreement by id (used by accept flow). */
  async getById(id: string) {
    const agreement = await this.prisma.agreement.findUnique({ where: { id } });
    if (!agreement) {
      throw new NotFoundException(`Agreement ${id} not found`);
    }
    return agreement;
  }

  /**
   * Record the user's acceptance of an agreement. Idempotent — if they
   * already accepted this version, returns the existing row.
   * Stores IP for legal audit.
   */
  async accept(opts: {
    userId: string;
    agreementId: string;
    ip: string;
  }) {
    const agreement = await this.getById(opts.agreementId);
    // upsert pattern since (userId, agreementId) is unique.
    return this.prisma.userAgreement.upsert({
      where: {
        userId_agreementId: {
          userId: opts.userId,
          agreementId: opts.agreementId,
        },
      },
      create: {
        userId: opts.userId,
        agreementId: opts.agreementId,
        versionSnapshot: agreement.version,
        acceptedFromIp: opts.ip,
      },
      update: {
        // No-op — re-acceptance of same version doesn't change the record.
      },
    });
  }

  /** Check if user has accepted the latest version of both agreement types. */
  async hasAcceptedLatest(userId: string): Promise<boolean> {
    const latest = await this.getLatest();
    if (!latest.terms || !latest.privacy) {
      // No agreements published yet — treat as accepted (dev only).
      return true;
    }
    const acceptances = await this.prisma.userAgreement.findMany({
      where: {
        userId,
        agreementId: { in: [latest.terms.id, latest.privacy.id] },
      },
    });
    return acceptances.length === 2;
  }
}
