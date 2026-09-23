/// Socket.IO message envelope — mirrors the server's zod EnvelopeSchema.
/// Every event (in + out) carries this shape.
class Envelope {
  final String type;
  final int seq;
  final String ts;
  final Map<String, dynamic> payload;

  const Envelope({
    required this.type,
    required this.seq,
    required this.ts,
    required this.payload,
  });

  factory Envelope.fromJson(Map<String, dynamic> json) {
    return Envelope(
      type: json['type'] as String,
      seq: (json['seq'] as num).toInt(),
      ts: json['ts'] as String,
      payload: (json['payload'] as Map<String, dynamic>?) ?? const {},
    );
  }

  Map<String, dynamic> toJson() => {
        'type': type,
        'seq': seq,
        'ts': ts,
        'payload': payload,
      };
}

/// Error envelope — emitted on the `error` event channel.
class ErrorEnvelope {
  final String code;
  final String message;
  final int? seq;
  final Map<String, dynamic>? details;

  const ErrorEnvelope({
    required this.code,
    required this.message,
    this.seq,
    this.details,
  });

  factory ErrorEnvelope.fromJson(Map<String, dynamic> json) {
    return ErrorEnvelope(
      code: json['code'] as String,
      message: json['message'] as String,
      seq: json['seq'] is num ? (json['seq'] as num).toInt() : null,
      details: json['details'] is Map ? Map<String, dynamic>.from(json['details'] as Map) : null,
    );
  }
}

/// Socket error codes — must match server `src/socket/errors/error-codes.ts`.
class SocketErrorCode {
  static const tokenExpired = 'TOKEN_EXPIRED';
  static const tokenInvalid = 'TOKEN_INVALID';
  static const tokenMissing = 'TOKEN_MISSING';
  static const sessionRevoked = 'SESSION_REVOKED';
  static const invalidEnvelope = 'INVALID_ENVELOPE';
  static const unknownEvent = 'UNKNOWN_EVENT';
  static const matchTimeout = 'MATCH_TIMEOUT';
  static const queueFull = 'QUEUE_FULL';
  static const alreadyInQueue = 'ALREADY_IN_QUEUE';
  static const notInQueue = 'NOT_IN_QUEUE';
  static const callNotFound = 'CALL_NOT_FOUND';
  static const callAlreadyActive = 'CALL_ALREADY_ACTIVE';
  static const peerDisconnected = 'PEER_DISCONNECTED';
  static const rateLimited = 'RATE_LIMITED';
  static const internalError = 'INTERNAL_ERROR';
}

/// Connection state machine.
enum SocketConnectionState {
  disconnected,
  connecting,
  connected,
  reconnecting,
  error,
}

/// Latency quality buckets — server emits these in latency:rtt.
enum LatencyQuality { good, fair, poor }
