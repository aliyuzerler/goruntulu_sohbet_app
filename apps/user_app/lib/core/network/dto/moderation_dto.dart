/// Phase 8: Moderation DTOs — mirror server API responses.

class CreateReportResponseDto {
  final String id;
  final String status;
  const CreateReportResponseDto({required this.id, required this.status});
  factory CreateReportResponseDto.fromJson(Map<String, dynamic> json) =>
      CreateReportResponseDto(
        id: json['id'] as String,
        status: json['status'] as String,
      );
}

class CaptureFrameResponseDto {
  final bool flagged;
  final String? reason;
  final String? s3Key;
  const CaptureFrameResponseDto({required this.flagged, this.reason, this.s3Key});
  factory CaptureFrameResponseDto.fromJson(Map<String, dynamic> json) =>
      CaptureFrameResponseDto(
        flagged: json['flagged'] as bool,
        reason: json['reason'] as String?,
        s3Key: json['s3Key'] as String?,
      );
}

class RateCallResponseDto {
  final String id;
  final bool alreadyProcessed;
  const RateCallResponseDto({required this.id, required this.alreadyProcessed});
  factory RateCallResponseDto.fromJson(Map<String, dynamic> json) =>
      RateCallResponseDto(
        id: json['id'] as String,
        alreadyProcessed: json['alreadyProcessed'] as bool,
      );
}

class ChatMessageResponseDto {
  final bool stored;
  final String content;
  final bool filtered;
  final String? blockedReason;
  const ChatMessageResponseDto({
    required this.stored,
    required this.content,
    required this.filtered,
    this.blockedReason,
  });
  factory ChatMessageResponseDto.fromJson(Map<String, dynamic> json) =>
      ChatMessageResponseDto(
        stored: json['stored'] as bool,
        content: json['content'] as String,
        filtered: json['filtered'] as bool,
        blockedReason: json['blockedReason'] as String?,
      );
}
