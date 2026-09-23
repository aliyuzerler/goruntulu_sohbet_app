import { z } from 'zod';

/**
 * Message envelope — every Socket.IO event (both inbound and outbound) carries
 * a payload in this shape. Validated on both sides with the same zod schema.
 *
 *   type   : event name (e.g. "queue:join", "match:found", "latency:pong")
 *   seq    : monotonic sequence number — per-socket, increments on each event.
 *            Used for ordering + dedup on reconnect (client can replay missed).
 *   ts     : server-issued ISO 8601 timestamp.
 *   payload: event-specific data; validated by a per-event sub-schema.
 *
 * Example:
 *   { type: "match:found", seq: 42, ts: "2024-01-01T00:00:00.000Z",
 *     payload: { callId: "...", peer: { id: "...", displayName: "..." } } }
 */
export const EnvelopeSchema = z.object({
  type: z.string().min(1).max(64),
  seq: z.number().int().nonnegative(),
  ts: z.string().datetime(),
  payload: z.unknown(),
});

export type Envelope = z.infer<typeof EnvelopeSchema>;

/**
 * Helper: build a typed envelope object.
 * Server-side use — always includes server timestamp.
 */
export function buildEnvelope<T>(
  type: string,
  seq: number,
  payload: T,
  ts: Date = new Date(),
): Envelope {
  return {
    type,
    seq,
    ts: ts.toISOString(),
    payload,
  };
}

/**
 * Error envelope — emitted on the `error` event channel.
 *   code    : one of SocketErrorCode
 *   message : human-readable, localized on the client by `code`
 *   seq     : the seq of the inbound event that caused the error (if applicable)
 *   details : optional structured details for debugging
 */
export const ErrorEnvelopeSchema = z.object({
  code: z.string(),
  message: z.string(),
  seq: z.number().int().nonnegative().optional(),
  details: z.unknown().optional(),
});

export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;
