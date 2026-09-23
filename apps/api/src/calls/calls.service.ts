import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgoraService } from './agora.service';
import { CallStatus } from '@prisma/client';

/**
 * CallsService — call lifecycle management.
 *
 * Lifecycle:
 *   WAITING (queued) → MATCHED (pair found, no video yet) → ACTIVE (RTC up)
 *     → ENDED (normal) or REPORTED (flagged for moderation)
 *
 * Methods:
 *   getToken — issue Agora RTC token for a user in a call
 *   start   — flip status MATCHED → ACTIVE, set startedAt
 *   end     — flip status to ENDED, set endedAt + durationSec
 */
@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly agora: AgoraService,
  ) {}

  /**
   * Issue an Agora RTC token for the local user in a call.
   * Validates the caller is part of the call — caller or callee.
   */
  async issueToken(opts: {
    callId: string;
    userId: string;
    role?: 'publisher' | 'subscriber';
  }): Promise<{ token: string; appId: string; channelName: string; uid: number; expiresInSeconds: number }> {
    const call = await this.prisma.call.findUnique({
      where: { id: opts.callId },
      select: { id: true, callerId: true, calleeId: true, agoraChannel: true, status: true },
    });
    if (!call) {
      throw new NotFoundException(`Call ${opts.callId} not found`);
    }
    if (call.callerId !== opts.userId && call.calleeId !== opts.userId) {
      throw new BadRequestException('Not a participant in this call');
    }
    // Status must be MATCHED or ACTIVE — can't get token for an ended call.
    if (call.status !== CallStatus.MATCHED && call.status !== CallStatus.ACTIVE) {
      throw new BadRequestException(`Call is ${call.status} — cannot issue token`);
    }
    const uid = this.agora.userUuidToUid(opts.userId);
    const token = this.agora.generateToken({
      channelName: call.agoraChannel,
      uid,
      role: opts.role ?? 'publisher',
    });
    return {
      token,
      appId: this.agora.isConfigured ? process.env.AGORA_APP_ID! : 'dev-app-id',
      channelName: call.agoraChannel,
      uid,
      expiresInSeconds: 3600,
    };
  }

  /**
   * Mark a call as started — caller typically calls this right after
   * joining the Agora channel. Sets status MATCHED → ACTIVE.
   */
  async startCall(opts: { callId: string; userId: string }): Promise<{ callId: string; status: CallStatus }> {
    const call = await this.prisma.call.findUnique({ where: { id: opts.callId } });
    if (!call) throw new NotFoundException(`Call ${opts.callId} not found`);
    if (call.callerId !== opts.userId && call.calleeId !== opts.userId) {
      throw new BadRequestException('Not a participant in this call');
    }
    if (call.status === CallStatus.ACTIVE) {
      // Idempotent — already started.
      return { callId: call.id, status: CallStatus.ACTIVE };
    }
    if (call.status !== CallStatus.MATCHED) {
      throw new BadRequestException(`Cannot start a call in ${call.status} status`);
    }
    const updated = await this.prisma.call.update({
      where: { id: opts.callId },
      data: { status: CallStatus.ACTIVE },
    });
    return { callId: updated.id, status: updated.status };
  }

  /**
   * Mark a call as ended — either side can end. Computes durationSec
   * from startedAt + endedAt. Persists endReason (Phase 5).
   */
  async endCall(opts: {
    callId: string;
    userId: string;
    reason?: string;
  }): Promise<{ callId: string; status: CallStatus; durationSec: number }> {
    const call = await this.prisma.call.findUnique({ where: { id: opts.callId } });
    if (!call) throw new NotFoundException(`Call ${opts.callId} not found`);
    if (call.callerId !== opts.userId && call.calleeId !== opts.userId) {
      throw new BadRequestException('Not a participant in this call');
    }
    if (call.status === CallStatus.ENDED || call.status === CallStatus.REPORTED) {
      // Idempotent.
      return {
        callId: call.id,
        status: call.status,
        durationSec: call.durationSec ?? 0,
      };
    }
    const now = new Date();
    const durationSec = Math.max(0, Math.floor((now.getTime() - call.startedAt.getTime()) / 1000));
    // Phase 5 endReasons: user_left, report, moderation, timeout, low_balance, peer_disconnected
    const validReasons = [
      'user_left',
      'report',
      'moderation',
      'timeout',
      'low_balance',
      'peer_disconnected',
      'system_error',
    ];
    const endReason = opts.reason && validReasons.includes(opts.reason)
      ? opts.reason
      : 'user_left';
    const updated = await this.prisma.call.update({
      where: { id: opts.callId },
      data: {
        status: CallStatus.ENDED,
        endedAt: now,
        durationSec,
        endReason,
      },
    });
    return { callId: updated.id, status: updated.status, durationSec };
  }

  /** Phase 5: record avg quality for KPI dashboards. Called by Phase 4 worker on call:end. */
  async recordAvgQuality(callId: string, avgQualityMs: number): Promise<void> {
    await this.prisma.call.update({
      where: { id: callId },
      data: { avgQualityMs },
    });
  }

  /**
   * Mark call as reported — moderation flow.
   * Phase 8 will add the full report review queue.
   */
  async reportCall(callId: string): Promise<{ callId: string; status: CallStatus }> {
    const updated = await this.prisma.call.update({
      where: { id: callId },
      data: { status: CallStatus.REPORTED },
    });
    return { callId: updated.id, status: updated.status };
  }
}
