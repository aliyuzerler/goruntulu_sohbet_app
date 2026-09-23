import { z } from 'zod';
import { MatchmakingEventRegistry } from './matchmaking.contract';
import { CallEventRegistry } from './call.contract';
import { PresenceEventRegistry, LatencyEventRegistry } from './presence-latency.contract';

/**
 * Combined event registry — the socket gateway uses this to:
 *   1. Validate inbound envelopes (reject unknown events with UNKNOWN_EVENT)
 *   2. Validate outbound envelopes (defense in depth — guards against bad
 *      server code emitting malformed payloads)
 *
 * Each entry is `{ direction: 'in' | 'out' | 'both', schema: zod }`.
 *
 * Phase 4 implements the matchmaking + call logic.
 */
type RegistryEntry = {
  direction: 'in' | 'out' | 'both';
  schema: z.ZodTypeAny;
};

function build(entries: Record<string, RegistryEntry>) {
  return entries;
}

// Phase 4 additions: room:join / room:leave + queue:joined (server→client ack).
const RoomJoinPayloadSchema = z.object({
  room: z.string().min(1).max(64),
});

const QueueJoinedPayloadSchema = z.object({
  position: z.number().int().nonnegative(),
  ts: z.string().datetime(),
});

export const EventRegistry = build({
  // Matchmaking — Phase 4.
  'queue:join': { direction: 'in', schema: MatchmakingEventRegistry['queue:join'] },
  'queue:leave': { direction: 'in', schema: MatchmakingEventRegistry['queue:leave'] },
  'queue:joined': { direction: 'out', schema: QueueJoinedPayloadSchema }, // ack
  'match:found': { direction: 'out', schema: MatchmakingEventRegistry['match:found'] },

  // Room join/leave — Phase 4. Client joins call:<callId> after match:found.
  'room:join': { direction: 'in', schema: RoomJoinPayloadSchema },
  'room:leave': { direction: 'in', schema: RoomJoinPayloadSchema },

  // Call signaling — relayed in Phase 4.
  'call:offer': { direction: 'both', schema: CallEventRegistry['call:offer'] },
  'call:answer': { direction: 'both', schema: CallEventRegistry['call:answer'] },
  'call:ice': { direction: 'both', schema: CallEventRegistry['call:ice'] },
  'call:end': { direction: 'both', schema: CallEventRegistry['call:end'] },

  // Presence
  heartbeat: { direction: 'in', schema: PresenceEventRegistry.heartbeat },
  'presence:online-count': {
    direction: 'out',
    schema: PresenceEventRegistry['presence:online-count'],
  },
  'presence:country-count': {
    direction: 'out',
    schema: PresenceEventRegistry['presence:country-count'],
  },

  // Latency
  'latency:ping': { direction: 'out', schema: LatencyEventRegistry['latency:ping'] },
  'latency:pong': { direction: 'in', schema: LatencyEventRegistry['latency:pong'] },
  'latency:rtt': { direction: 'out', schema: LatencyEventRegistry['latency:rtt'] },
});

export type EventType = keyof typeof EventRegistry;

/**
 * Validate an inbound envelope against the registry.
 * Returns `{ ok: true }` or `{ ok: false, code }` (SocketErrorCode).
 */
export function validateInbound(type: string): {
  ok: boolean;
  schema?: z.ZodTypeAny;
  code?: 'UNKNOWN_EVENT' | 'DIRECTION_MISMATCH';
} {
  const entry = EventRegistry[type as EventType];
  if (!entry) return { ok: false, code: 'UNKNOWN_EVENT' };
  if (entry.direction === 'out') {
    // Client shouldn't send outbound events.
    return { ok: false, code: 'DIRECTION_MISMATCH' };
  }
  return { ok: true, schema: entry.schema };
}

export function validateOutbound(type: string): {
  ok: boolean;
  schema?: z.ZodTypeAny;
} {
  const entry = EventRegistry[type as EventType];
  if (!entry) return { ok: false };
  if (entry.direction === 'in') return { ok: false };
  return { ok: true, schema: entry.schema };
}
