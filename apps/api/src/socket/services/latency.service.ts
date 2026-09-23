import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

/**
 * LatencyService — measures per-socket RTT (round-trip time).
 *
 * Flow:
 *   1. Server emits `latency:ping` every LATENCY_PING_INTERVAL_SEC seconds,
 *      carrying `{ pingId, serverTs }`.
 *   2. Client echoes `latency:pong` with the same `pingId`.
 *   3. Server computes RTT = now - serverTs, then emits `latency:rtt` with
 *      `{ rttMs, quality }` to the client.
 *
 * Quality buckets:
 *   good : rttMs <= LATENCY_GOOD_MS (default 200ms)
 *   fair : rttMs <= LATENCY_FAIR_MS (default 500ms)
 *   poor : rttMs >  LATENCY_FAIR_MS
 *
 * Implementation: server keeps a Map<socketId, pendingPing> in memory.
 * Phase 8 may move this to Redis if we want RTT across instances.
 */
@Injectable()
export class LatencyService {
  private readonly logger = new Logger(LatencyService.name);
  private readonly intervalSec: number;
  private readonly goodMs: number;
  private readonly fairMs: number;
  private readonly pending = new Map<string, { pingId: string; issuedAt: number }>();

  constructor(config: ConfigService) {
    this.intervalSec = config.get<number>('LATENCY_PING_INTERVAL_SEC') ?? 15;
    this.goodMs = config.get<number>('LATENCY_GOOD_MS') ?? 200;
    this.fairMs = config.get<number>('LATENCY_FAIR_MS') ?? 500;
  }

  /** How often the server emits pings, in milliseconds. */
  get pingIntervalMs(): number {
    return this.intervalSec * 1000;
  }

  /** Build the next ping payload. Caller stores the pingId for the socket. */
  issuePing(socketId: string): { pingId: string; serverTs: string } {
    const pingId = randomUUID();
    const issuedAt = Date.now();
    this.pending.set(socketId, { pingId, issuedAt });
    return { pingId, serverTs: new Date(issuedAt).toISOString() };
  }

  /**
   * Handle a pong from a client. Returns the RTT payload if the ping was
   * still pending, null otherwise (pong was for an old/expired ping or the
   * client fabricated a pingId).
   */
  receivePong(socketId: string, pingId: string): {
    rttMs: number;
    quality: 'good' | 'fair' | 'poor';
  } | null {
    const pending = this.pending.get(socketId);
    if (!pending || pending.pingId !== pingId) {
      // Either we never issued this ping or the socket disconnected and reconnected.
      return null;
    }
    const rttMs = Date.now() - pending.issuedAt;
    this.pending.delete(socketId);
    return {
      rttMs,
      quality: rttMs <= this.goodMs ? 'good' : rttMs <= this.fairMs ? 'fair' : 'poor',
    };
  }

  /** Called on socket disconnect — drop the pending ping so RTT doesn't
   *  get computed against a stale timestamp. */
  clearPending(socketId: string): void {
    this.pending.delete(socketId);
  }

  /** Thresholds exposed for testing + diagnostics. */
  get thresholds() {
    return { goodMs: this.goodMs, fairMs: this.fairMs };
  }
}
