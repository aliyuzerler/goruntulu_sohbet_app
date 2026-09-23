import { z } from 'zod';

/**
 * Presence + Latency event contracts.
 *
 * Presence:
 *   heartbeat            : client → server, refreshes presence TTL
 *   presence:online-count: server → client, periodic broadcast of total online
 *   presence:country-count: server → client, periodic broadcast of per-country counts
 *
 * Latency:
 *   latency:ping         : server → client, with server-issued timestamp
 *   latency:pong         : client → server, echoes the same timestamp
 *   latency:rtt          : server → client, RTT in milliseconds (calculated by server)
 */

// ─── Presence ────────────────────────────────────────────────────────────────
export const HeartbeatPayloadSchema = z.object({
  /** Optional client timestamp — server uses received time for TTL, but compares
   *  client timestamp for skew detection (Phase 8). */
  clientTs: z.string().datetime().optional(),
});
export type HeartbeatPayload = z.infer<typeof HeartbeatPayloadSchema>;

export const PresenceOnlineCountPayloadSchema = z.object({
  total: z.number().int().nonnegative(),
  ts: z.string().datetime(),
});
export type PresenceOnlineCountPayload = z.infer<typeof PresenceOnlineCountPayloadSchema>;

export const PresenceCountryCountPayloadSchema = z.object({
  /** Map of ISO 3166-1 alpha-2 → count. Top 20 countries only — others bucketed. */
  counts: z.record(z.string(), z.number().int().nonnegative()),
  ts: z.string().datetime(),
});
export type PresenceCountryCountPayload = z.infer<typeof PresenceCountryCountPayloadSchema>;

// ─── Latency ─────────────────────────────────────────────────────────────────
export const LatencyPingPayloadSchema = z.object({
  /** Server-issued ping id (UUID). Client must echo this in the pong. */
  pingId: z.string().uuid(),
  /** Server timestamp when the ping was issued (ISO 8601). */
  serverTs: z.string().datetime(),
});
export type LatencyPingPayload = z.infer<typeof LatencyPingPayloadSchema>;

export const LatencyPongPayloadSchema = z.object({
  /** Must match the pingId from the latest ping. */
  pingId: z.string().uuid(),
});
export type LatencyPongPayload = z.infer<typeof LatencyPongPayloadSchema>;

export const LatencyRttPayloadSchema = z.object({
  /** Round-trip time in milliseconds for the latest ping/pong pair. */
  rttMs: z.number().int().nonnegative(),
  /** Quality bucket — used by client to color the latency indicator. */
  quality: z.enum(['good', 'fair', 'poor']),
});
export type LatencyRttPayload = z.infer<typeof LatencyRttPayloadSchema>;

export const PresenceEventRegistry = {
  heartbeat: HeartbeatPayloadSchema,
  'presence:online-count': PresenceOnlineCountPayloadSchema,
  'presence:country-count': PresenceCountryCountPayloadSchema,
} as const;

export const LatencyEventRegistry = {
  'latency:ping': LatencyPingPayloadSchema,
  'latency:pong': LatencyPongPayloadSchema,
  'latency:rtt': LatencyRttPayloadSchema,
} as const;
