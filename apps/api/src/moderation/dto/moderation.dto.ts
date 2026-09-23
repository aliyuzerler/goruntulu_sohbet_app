import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

/** POST /moderation/report — single-tap report. */
class CreateReportDto {
  @IsUUID()
  reportedId!: string;

  @IsOptional()
  @IsUUID()
  callId?: string;

  @IsEnum(['INAPPROPRIATE', 'HARASSMENT', 'SPAM', 'MINOR', 'OTHER'])
  reason!: 'INAPPROPRIATE' | 'HARASSMENT' | 'SPAM' | 'MINOR' | 'OTHER';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** POST /moderation/block — block user. */
class BlockUserDto {
  @IsUUID()
  blockedId!: string;
}

/** POST /moderation/capture-frame — NSFW pipeline. */
class CaptureFrameDto {
  @IsUUID()
  callId!: string;

  /// Base64-encoded JPEG frame.
  @IsString()
  frameBase64!: string;
}

/** POST /moderation/rate — post-call rating. */
class RateCallDto {
  @IsUUID()
  callId!: string;

  @IsUUID()
  targetUserId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  stars!: number;
}

/** POST /moderation/chat — in-call chat message. */
class ChatMessageDto {
  @IsUUID()
  callId!: string;

  @IsString()
  @MaxLength(500)
  content!: string;
}

/** POST /moderation/ban — admin action. */
class BanUserDto {
  @IsUUID()
  userId!: string;

  @IsString()
  @MaxLength(200)
  reason!: string;
}

/** POST /moderation/resolve — admin action. */
class ResolveReportDto {
  @IsEnum(['RESOLVED', 'DISMISSED'])
  resolution!: 'RESOLVED' | 'DISMISSED';
}

export {
  CreateReportDto,
  BlockUserDto,
  CaptureFrameDto,
  RateCallDto,
  ChatMessageDto,
  BanUserDto,
  ResolveReportDto,
};
