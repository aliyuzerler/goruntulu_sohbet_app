/// Call-related DTOs — mirror the server's API responses + socket envelopes.

class AgoraTokenDto {
  final String token;
  final String appId;
  final String channelName;
  final int uid;
  final int expiresInSeconds;

  const AgoraTokenDto({
    required this.token,
    required this.appId,
    required this.channelName,
    required this.uid,
    required this.expiresInSeconds,
  });

  factory AgoraTokenDto.fromJson(Map<String, dynamic> json) {
    return AgoraTokenDto(
      token: json['token'] as String,
      appId: json['appId'] as String,
      channelName: json['channelName'] as String,
      uid: (json['uid'] as num).toInt(),
      expiresInSeconds: (json['expiresInSeconds'] as num).toInt(),
    );
  }
}

class CallStatusDto {
  final String callId;
  final String status;
  final int? durationSec;

  const CallStatusDto({
    required this.callId,
    required this.status,
    required this.durationSec,
  });

  factory CallStatusDto.fromJson(Map<String, dynamic> json) {
    return CallStatusDto(
      callId: json['callId'] as String,
      status: json['status'] as String,
      durationSec: json['durationSec'] is num ? (json['durationSec'] as num).toInt() : null,
    );
  }
}

/// Mirrors MatchFoundPayload from server's matchmaking.service.ts.
class MatchFoundPayload {
  final String callId;
  final String agoraChannel;
  final String? agoraToken;
  final MatchPeer peer;
  final String role; // 'caller' | 'callee'

  const MatchFoundPayload({
    required this.callId,
    required this.agoraChannel,
    this.agoraToken,
    required this.peer,
    required this.role,
  });

  factory MatchFoundPayload.fromJson(Map<String, dynamic> json) {
    return MatchFoundPayload(
      callId: json['callId'] as String,
      agoraChannel: json['agoraChannel'] as String,
      agoraToken: json['agoraToken'] as String?,
      peer: MatchPeer.fromJson(json['peer'] as Map<String, dynamic>),
      role: json['role'] as String,
    );
  }
}

class MatchPeer {
  final String id;
  final String displayName;
  final String? avatarUrl;
  final String? country;
  final String? gender;

  const MatchPeer({
    required this.id,
    required this.displayName,
    this.avatarUrl,
    this.country,
    this.gender,
  });

  factory MatchPeer.fromJson(Map<String, dynamic> json) {
    return MatchPeer(
      id: json['id'] as String,
      displayName: json['displayName'] as String,
      avatarUrl: json['avatarUrl'] as String?,
      country: json['country'] as String?,
      gender: json['gender'] as String?,
    );
  }
}

/// Call-end payload from socket.io call:end envelope.
class CallEndPayload {
  final String callId;
  final String? reason;

  const CallEndPayload({required this.callId, this.reason});

  factory CallEndPayload.fromJson(Map<String, dynamic> json) {
    return CallEndPayload(
      callId: json['callId'] as String,
      reason: json['reason'] as String?,
    );
  }
}
