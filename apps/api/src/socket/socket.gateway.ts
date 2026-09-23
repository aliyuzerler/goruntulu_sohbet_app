import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { SocketHandshakeAuth } from './services/socket-handshake-auth';
import { PresenceService } from './services/presence.service';
import { LatencyService } from './services/latency.service';
import { EnvelopeSchema, buildEnvelope, ErrorEnvelope } from './envelope/envelope.schema';
import { validateInbound } from './contracts/registry';
import { SocketErrorCode } from './errors/error-codes';
import { MatchmakingService, PendingMatch } from '../matchmaking/matchmaking.service';
import { DailyQuotaService } from '../matchmaking/daily-quota.service';
import { CallsService } from '../calls/calls.service';
import { CallStatus } from '@prisma/client';

/**
 * SocketGateway — the single WebSocket gateway for RandChat.
 *
 * Events handled in Phase 3:
 *   heartbeat              : client → server (refresh presence TTL)
 *   latency:pong          : client → server (RTT measurement)
 *
 * Events validated but NOT yet implemented (Phase 4 will add logic):
 *   queue:join, queue:leave   : matchmaking — gateway validates and NACKs
 *   call:offer, call:answer, call:ice, call:end : relayed peer-to-peer
 *
 * The gateway validates every inbound envelope against the registry.
 * Invalid envelopes get an `error` event with INVALID_ENVELOPE.
 *
 * Per-socket sequence counter: server increments seq on every outbound event.
 * Client can use seq for ordering + dedup on reconnect (Phase 7).
 */
@WebSocketGateway({
  namespace: '/',
  cors: {
    origin: '*', // Phase 7 will restrict via SOCKET_IO_CORS_ORIGINS
    credentials: true,
  },
  pingInterval: 25_000, // Built-in transport ping
  pingTimeout: 20_000,
})
export class SocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(SocketGateway.name);
  private readonly heartbeatIntervalMs: number;
  private readonly latencyPingIntervalMs: number;
  private readonly broadcastIntervalMs: number;
  private broadcastTimer: NodeJS.Timeout | null = null;

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly auth: SocketHandshakeAuth,
    private readonly prisma: PrismaService,
    private readonly presence: PresenceService,
    private readonly latency: LatencyService,
    private readonly matchmaking: MatchmakingService,
    private readonly quota: DailyQuotaService,
    private readonly calls: CallsService,
    private readonly config: ConfigService,
  ) {
    this.heartbeatIntervalMs = (config.get<number>('HEARTBEAT_INTERVAL_SEC') ?? 30) * 1000;
    this.latencyPingIntervalMs = (config.get<number>('LATENCY_PING_INTERVAL_SEC') ?? 15) * 1000;
    // Presence broadcast every 30s — syncs online count + country breakdown.
    this.broadcastIntervalMs = 30_000;
  }

  // ─── Lifecycle hooks ──────────────────────────────────────────────────

  afterInit() {
    this.logger.log('✓ Socket gateway initialized');
    // Start the periodic presence broadcast + latency ping loop.
    this.broadcastTimer = setInterval(
      () => void this.broadcastPresence(),
      this.broadcastIntervalMs,
    );
    // Phase 4: matchmaking worker tick (1s).
    this.matchmaking.startWorker();
  }

  async handleConnection(client: Socket, ..._args: unknown[]): Promise<void> {
    try {
      const user = await this.auth.verify(client.handshake);
      // Stash user info on the socket for use in event handlers.
      (client.data as { user: typeof user }).user = user;
      (client.data as { seq: number }).seq = 0;
      (client.data as { lastHeartbeat: number }).lastHeartbeat = Date.now();

      // Look up country for presence breakdown — DB Profile.country.
      const profile = await this.prisma.profile.findUnique({
        where: { userId: user.id },
        select: { country: true, displayName: true },
      });

      // Refresh presence immediately.
      await this.presence.refresh({
        userId: user.id,
        country: profile?.country,
        deviceId: user.deviceId,
      });

      // Start the per-socket latency ping loop.
      this.startLatencyLoop(client);

      // Wire the catch-all message handler — validates every inbound envelope
      // against the contract registry.
      this.wireCatchAll(client);

      // Tell the client they're connected.
      this.sendEnvelope(client, 'connected', {
        userId: user.id,
        heartbeatIntervalSec: Math.floor(this.heartbeatIntervalMs / 1000),
        latencyPingIntervalSec: Math.floor(this.latencyPingIntervalMs / 1000),
        profile: profile ?? null,
      });

      this.logger.log(`✓ Connected: ${user.id} (${client.id})`);
    } catch (e) {
      this.logger.warn(`Connection rejected: ${(e as Error).message}`);
      client.emit('error', {
        code: SocketErrorCode.TOKEN_INVALID,
        message: 'Authentication failed',
      } satisfies ErrorEnvelope);
      // Tiny delay so the error event arrives before the disconnect.
      setTimeout(() => client.disconnect(true), 50);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const user = (client.data as { user?: { id: string } }).user;
    if (user?.id) {
      // Stop latency loop.
      this.stopLatencyLoop(client);
      this.latency.clearPending(client.id);
      // Phase 4: leave all call rooms + remove from queue.
      const rooms = Array.from(client.rooms);
      for (const room of rooms) {
        if (room.startsWith('call:')) {
          void this.server.to(room).except(client.id).emit(
            'message',
            buildEnvelope('call:end', 0, { callId: room.slice(5), reason: 'peer_disconnected' }),
          );
        }
      }
      await this.matchmaking.leaveQueue({ userId: user.id }).catch(() => {});
      // Remove from presence.
      await this.presence.remove(user.id);
      this.logger.log(`✗ Disconnected: ${user.id} (${client.id})`);
    }
  }

  // ─── Inbound events ──────────────────────────────────────────────────

  /**
   * Catch-all handler — fires when client emits an event not explicitly
   * @SubscribeMessage'd below. We use it to validate every envelope and
   * dispatch via the contract registry. Phase 3 returns NOT_IMPLEMENTED for
   * matchmaking + call events (Phase 4 will add real handlers).
   *
   * Note: socket.io's @SubscribeMessage requires the event name at decorator
   * time. To do catch-all, we listen on the socket's `message` event from
   * the raw socket in onAfterConnection. That's set up below.
   */
  private wireCatchAll(client: Socket) {
    client.on('message', (raw: unknown) => {
      void this.handleRawEnvelope(client, raw).catch((e) => {
        this.logger.error(`Envelope handler failed: ${(e as Error).message}`);
      });
    });
  }

  private async handleRawEnvelope(client: Socket, raw: unknown): Promise<void> {
    const parsed = EnvelopeSchema.safeParse(raw);
    if (!parsed.success) {
      this.emitError(client, SocketErrorCode.INVALID_ENVELOPE, 'Malformed envelope', raw);
      return;
    }
    const env = parsed.data;
    const meta = validateInbound(env.type);

    if (!meta.ok) {
      this.emitError(
        client,
        meta.code === 'DIRECTION_MISMATCH'
          ? SocketErrorCode.INVALID_ENVELOPE
          : SocketErrorCode.UNKNOWN_EVENT,
        `Unknown or wrong-direction event: ${env.type}`,
        env.seq,
      );
      return;
    }

    // Validate the inner payload against the per-event schema.
    const payloadParsed = meta.schema!.safeParse(env.payload);
    if (!payloadParsed.success) {
      this.emitError(
        client,
        SocketErrorCode.INVALID_ENVELOPE,
        `Bad payload for ${env.type}: ${payloadParsed.error.message}`,
        env.seq,
      );
      return;
    }

    // Dispatch — Phase 4 implements matchmaking + call events.
    switch (env.type) {
      case 'heartbeat':
        await this.handleHeartbeat(client, payloadParsed.data);
        // Also drain pending match for this user (from matchmaking service).
        this.drainAndEmitMatch(client);
        break;
      case 'latency:pong':
        this.handleLatencyPong(client, payloadParsed.data);
        break;
      case 'queue:join':
        await this.handleQueueJoin(client, payloadParsed.data);
        break;
      case 'queue:leave':
        await this.handleQueueLeave(client, payloadParsed.data);
        break;
      case 'room:join':
        await this.handleRoomJoin(client, payloadParsed.data);
        break;
      case 'room:leave':
        await this.handleRoomLeave(client, payloadParsed.data);
        break;
      case 'call:offer':
      case 'call:answer':
      case 'call:ice':
        this.relayCallEvent(client, env.type, payloadParsed.data);
        break;
      case 'call:end':
        await this.handleCallEnd(client, payloadParsed.data);
        break;
      default:
        this.emitError(
          client,
          SocketErrorCode.UNKNOWN_EVENT,
          `Unhandled event: ${env.type}`,
          env.seq,
        );
    }
  }

  // ─── Matchmaking handlers (Phase 5) ─────────────────────────────────

  private async handleQueueJoin(
    client: Socket,
    payload: { genderFilters?: string[]; countryFilters?: string[] },
  ): Promise<void> {
    const user = (client.data as { user: { id: string } }).user;
    if (!user) return;
    const r = await this.matchmaking.joinQueue({
      userId: user.id,
      genderFilters: payload.genderFilters,
      countryFilters: payload.countryFilters,
    });
    if (r.kind === 'ok') {
      this.sendEnvelope(client, 'queue:joined', {
        position: r.position,
        charge: r.charge,
        remainingFree: r.remainingFree,
        ts: new Date().toISOString(),
      });
      this.drainAndEmitMatch(client);
    } else if (r.kind === 'cooldown') {
      this.emitError(
        client,
        SocketErrorCode.RATE_LIMITED,
        `Skip cooldown — retry in ${r.retryAfterSec}s`,
        { retryAfterSec: r.retryAfterSec },
      );
    } else if (r.kind === 'skip_timeout') {
      this.emitError(
        client,
        SocketErrorCode.RATE_LIMITED,
        `Too many consecutive skips — timeout ${r.retryAfterSec}s`,
        { retryAfterSec: r.retryAfterSec },
      );
    } else if (r.kind === 'low_balance') {
      // Phase 5: low_balance event — client routes to /wallet.
      this.sendEnvelope(client, 'low_balance', {
        needed: r.needed,
        remainingFree: r.remainingFree,
      });
    }
  }

  private async handleQueueLeave(_client: Socket, _payload: unknown): Promise<void> {
    const user = (_client.data as { user: { id: string } }).user;
    if (!user) return;
    await this.matchmaking.leaveQueue({ userId: user.id });
  }

  private async handleRoomJoin(client: Socket, payload: { room: string }): Promise<void> {
    await client.join(payload.room);
    // No envelope back — silent success.
  }

  private async handleRoomLeave(client: Socket, payload: { room: string }): Promise<void> {
    await client.leave(payload.room);
  }

  /**
   * Drain a pending match from MatchmakingService and emit `match:found`
   * to the client if one exists. Called on connect + heartbeat + queue:join.
   */
  private drainAndEmitMatch(client: Socket): void {
    const user = (client.data as { user: { id: string } }).user;
    if (!user) return;
    const match = this.matchmaking.drainPendingMatch(user.id);
    if (!match) return;
    if (match.lowBalance) {
      // Phase 5: low_balance variant — match was created but couldn't charge.
      this.sendEnvelope(client, 'low_balance', {
        callId: match.callId,
        ...match.lowBalance,
      });
      return;
    }
    this.sendEnvelope<PendingMatch>(client, 'match:found', match);
    setTimeout(() => void this.handleRingingTimeout(client, match.callId), 30_000);
  }

  /** Phase 5: ringing timeout — reason='timeout' (was match_timeout). */
  private async handleRingingTimeout(client: Socket, callId: string): Promise<void> {
    const user = (client.data as { user: { id: string } }).user;
    if (!user) return;
    try {
      const call = await this.prisma.call.findUnique({
        where: { id: callId },
        select: { id: true, status: true },
      });
      if (!call) return;
      if (call.status !== CallStatus.MATCHED) return;
      await this.calls.endCall({
        callId,
        userId: user.id,
        reason: 'timeout',
      });
      this.sendEnvelope(client, 'call:end', { callId, reason: 'timeout' });
    } catch (e) {
      this.logger.warn(`Ringing timeout check failed: ${(e as Error).message}`);
    }
  }

  // ─── Call relay handlers (Phase 5) ──────────────────────────────────
  private relayCallEvent(client: Socket, type: string, payload: { callId: string }): void {
    const user = (client.data as { user: { id: string } }).user;
    if (!user) return;
    void this.server
      .to(`call:${payload.callId}`)
      .except(client.id)
      .emit('message', buildEnvelope(type, 0, payload));
  }

  private async handleCallEnd(client: Socket, payload: { callId: string; reason?: string }): Promise<void> {
    const user = (client.data as { user: { id: string } }).user;
    if (!user) return;
    try {
      // Phase 5: record skip if reason is user_left (Next button).
      if (payload.reason === 'user_left') {
        await this.matchmaking.recordSkip({
          userId: user.id,
          callId: payload.callId,
        });
      }
      const r = await this.calls.endCall({
        callId: payload.callId,
        userId: user.id,
        reason: payload.reason,
      });
      void this.server
        .to(`call:${payload.callId}`)
        .except(client.id)
        .emit('message', buildEnvelope('call:end', 0, { callId: r.callId, reason: payload.reason }));
    } catch (e) {
      this.emitError(
        client,
        SocketErrorCode.CALL_NOT_FOUND,
        (e as Error).message,
        undefined,
      );
    }
  }

  // ─── Heartbeat ──────────────────────────────────────────────────────

  private async handleHeartbeat(client: Socket, _payload: unknown): Promise<void> {
    const user = (client.data as { user?: { id: string } }).user;
    if (!user) return;
    (client.data as { lastHeartbeat: number }).lastHeartbeat = Date.now();
    await this.presence.refresh({
      userId: user.id,
      deviceId: (client.data as { user: { deviceId?: string } }).user.deviceId,
    });
    // Don't emit anything back — silence = "I'm still here" (less bandwidth).
  }

  // ─── Latency ──────────────────────────────────────────────────────────

  private startLatencyLoop(client: Socket): void {
    // Stash the timer on the socket so we can clear it on disconnect.
    const timer = setInterval(() => {
      void this.sendLatencyPing(client);
    }, this.latencyPingIntervalMs);
    (client.data as { latencyTimer?: NodeJS.Timeout }).latencyTimer = timer;
    // Fire one immediately so the client gets a quality reading fast.
    void this.sendLatencyPing(client);
  }

  private stopLatencyLoop(client: Socket): void {
    const timer = (client.data as { latencyTimer?: NodeJS.Timeout }).latencyTimer;
    if (timer) {
      clearInterval(timer);
      (client.data as { latencyTimer?: NodeJS.Timeout }).latencyTimer = undefined;
    }
  }

  private async sendLatencyPing(client: Socket): Promise<void> {
    const pingPayload = this.latency.issuePing(client.id);
    this.sendEnvelope(client, 'latency:ping', pingPayload);
  }

  private handleLatencyPong(client: Socket, payload: { pingId: string }): void {
    const rtt = this.latency.receivePong(client.id, payload.pingId);
    if (!rtt) {
      // Pong didn't match pending ping — likely from a stale ping or a re-issue.
      // Silently drop; the next ping will produce a fresh RTT.
      return;
    }
    this.sendEnvelope(client, 'latency:rtt', rtt);
  }

  // ─── Presence broadcast ────────────────────────────────────────────

  private async broadcastPresence(): Promise<void> {
    if (!this.server) return;
    try {
      const [total, counts] = await Promise.all([
        this.presence.getOnlineCount(),
        this.presence.getCountryCounts(),
      ]);
      const ts = new Date().toISOString();
      // Broadcast to every connected client.
      this.server.emit('presence:online-count', { total, ts });
      this.server.emit('presence:country-count', { counts, ts });
    } catch (e) {
      this.logger.warn(`Presence broadcast failed: ${(e as Error).message}`);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  /**
   * Build + emit a typed envelope to a single socket. Increments the
   * per-socket sequence counter.
   */
  private sendEnvelope<T>(client: Socket, type: string, payload: T): void {
    const seq = (client.data as { seq: number }).seq ?? 0;
    (client.data as { seq: number }).seq = seq + 1;
    client.emit('message', buildEnvelope(type, seq, payload));
  }

  private emitError(
    client: Socket,
    code: string,
    message: string,
    seqOrRaw: number | unknown = undefined,
  ): void {
    const err: ErrorEnvelope = {
      code,
      message,
      ...(typeof seqOrRaw === 'number' ? { seq: seqOrRaw } : {}),
    };
    client.emit('error', err);
  }
}
