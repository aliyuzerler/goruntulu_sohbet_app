/**
 * Socket.IO error codes — stable across server and client.
 * Used as `code` field in error envelopes sent via the `error` event.
 *
 * Convention: <DOMAIN>_<FAILURE>
 */
export const SocketErrorCode = {
  // Auth — handshake failed or token expired mid-session
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TOKEN_MISSING: 'TOKEN_MISSING',
  SESSION_REVOKED: 'SESSION_REVOKED',

  // Envelope validation — bad payload shape
  INVALID_ENVELOPE: 'INVALID_ENVELOPE',
  UNKNOWN_EVENT: 'UNKNOWN_EVENT',

  // Matchmaking (contract defined in this phase; logic in Phase 4)
  MATCH_TIMEOUT: 'MATCH_TIMEOUT',
  QUEUE_FULL: 'QUEUE_FULL',
  ALREADY_IN_QUEUE: 'ALREADY_IN_QUEUE',
  NOT_IN_QUEUE: 'NOT_IN_QUEUE',

  // Call lifecycle (Phase 4)
  CALL_NOT_FOUND: 'CALL_NOT_FOUND',
  CALL_ALREADY_ACTIVE: 'CALL_ALREADY_ACTIVE',
  PEER_DISCONNECTED: 'PEER_DISCONNECTED',

  // Rate limit (per-event)
  RATE_LIMITED: 'RATE_LIMITED',

  // Internal
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type SocketErrorCode = (typeof SocketErrorCode)[keyof typeof SocketErrorCode];
