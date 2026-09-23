import { z } from 'zod';

/**
 * Matchmaking event contracts.
 *
 * Client → Server:
 *   queue:join   : user joins the matchmaking queue (filters in payload)
 *   queue:leave  : user leaves the queue (or just disconnects — server-side cleanup)
 *
 * Server → Client:
 *   match:found  : server paired this user with another. Both clients get this event
 *                  with the same callId, and the rest of the signaling (offer/answer/ice)
 *                  happens via call:* events below.
 *
 * Implementation lands in Phase 4. This file is the schema contract — the server
 * already validates inbound envelopes against these schemas, but doesn't actually
 * process them yet (returns NOT_IMPLEMENTED for now).
 */

// ─── queue:join ────────────────────────────────────────────────────────────
export const QueueJoinPayloadSchema = z.object({
  /** Filter: only match with users of these genders (empty = no filter). */
  genderFilters: z.array(z.enum(['MALE', 'FEMALE', 'OTHER'])).max(3).default([]),
  /** Filter: only match with users from these ISO 3166-1 alpha-2 countries. */
  countryFilters: z.array(z.string().length(2)).max(20).default([]),
});
export type QueueJoinPayload = z.infer<typeof QueueJoinPayloadSchema>;

// ─── queue:leave ────────────────────────────────────────────────────────────
export const QueueLeavePayloadSchema = z.object({}).strict();
export type QueueLeavePayload = z.infer<typeof QueueLeavePayloadSchema>;

// ─── match:found ────────────────────────────────────────────────────────────
export const MatchFoundPeerSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  avatarUrl: z.string().nullable().optional(),
  country: z.string().length(2).nullable().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED']).optional(),
});

export const MatchFoundPayloadSchema = z.object({
  callId: z.string().uuid(),
  /** Agora RTC channel name — both clients join this channel. */
  agoraChannel: z.string().min(1).max(128),
  /** Server-issued Agora user token for the local user (Phase 4 will wire real tokens). */
  agoraToken: z.string().optional(),
  /** Peer info (not the local user — the other side of the match). */
  peer: MatchFoundPeerSchema,
  /** Role hint: "caller" initiates the offer, "callee" waits for it. */
  role: z.enum(['caller', 'callee']),
});
export type MatchFoundPayload = z.infer<typeof MatchFoundPayloadSchema>;

/**
 * Matchmaking event registry — used by the socket gateway to dispatch.
 * Each entry maps the event name to the payload zod schema.
 */
export const MatchmakingEventRegistry = {
  'queue:join': QueueJoinPayloadSchema,
  'queue:leave': QueueLeavePayloadSchema,
  'match:found': MatchFoundPayloadSchema,
} as const;
