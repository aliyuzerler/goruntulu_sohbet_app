import { z } from 'zod';

/**
 * Call signaling event contracts — relayed peer-to-peer through the server.
 *
 *   offer  : caller → callee (SDP offer)
 *   answer : callee → caller (SDP answer)
 *   ice    : bidirectional (ICE candidate exchange)
 *   end    : either side → other (hang up)
 *
 * Server relays via call:<event>:<callId> rooms. Both peers are auto-joined to
 * the call's room on match:found, so the server doesn't need to know which
 * peer is on which socket — just emit to the room.
 *
 * Implementation: gateway just validates + relays in Phase 3.
 * Agora integration (real RTC) lands in Phase 4.
 */

// ─── call:offer ─────────────────────────────────────────────────────────────
export const CallOfferPayloadSchema = z.object({
  callId: z.string().uuid(),
  /** SDP offer (WebRTC SessionDescription, JSON-stringified). */
  sdp: z.string(),
  sdpType: z.literal('offer'),
});
export type CallOfferPayload = z.infer<typeof CallOfferPayloadSchema>;

// ─── call:answer ────────────────────────────────────────────────────────────
export const CallAnswerPayloadSchema = z.object({
  callId: z.string().uuid(),
  sdp: z.string(),
  sdpType: z.literal('answer'),
});
export type CallAnswerPayload = z.infer<typeof CallAnswerPayloadSchema>;

// ─── call:ice ───────────────────────────────────────────────────────────────
export const CallIcePayloadSchema = z.object({
  callId: z.string().uuid(),
  candidate: z.unknown(), // RTCIceCandidateInit
});
export type CallIcePayload = z.infer<typeof CallIcePayloadSchema>;

// ─── call:end ────────────────────────────────────────────────────────────────
export const CallEndPayloadSchema = z.object({
  callId: z.string().uuid(),
  reason: z.enum([
    'user_hangup',
    'peer_hangup',
    'peer_disconnected',
    'match_timeout',
    'moderation',
    'system_error',
  ]).optional(),
});
export type CallEndPayload = z.infer<typeof CallEndPayloadSchema>;

export const CallEventRegistry = {
  'call:offer': CallOfferPayloadSchema,
  'call:answer': CallAnswerPayloadSchema,
  'call:ice': CallIcePayloadSchema,
  'call:end': CallEndPayloadSchema,
} as const;
