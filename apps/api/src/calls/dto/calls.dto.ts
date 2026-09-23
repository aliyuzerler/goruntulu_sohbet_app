import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

/** POST /calls/:id/agora-token — request an RTC token for the call. */
export class AgoraTokenRequestDto {
  /** Optional role hint — publisher (default) for callers, subscriber for viewers. */
  @IsOptional()
  @IsEnum(['publisher', 'subscriber'])
  role?: 'publisher' | 'subscriber';
}

/** POST /calls/:id/agora-token — response. */
export class AgoraTokenResponseDto {
  token!: string;
  appId!: string;
  channelName!: string;
  uid!: number;
  /** Token expiry in seconds from now. */
  expiresInSeconds!: number;
}

/** POST /calls/:id/start — body. */
export class StartCallDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  sdpOffer?: string;
}

/** POST /calls/:id/end — body. */
export class EndCallDto {
  @IsOptional()
  @IsEnum([
    'user_hangup',
    'peer_hangup',
    'peer_disconnected',
    'match_timeout',
    'moderation',
    'system_error',
  ])
  reason?:
    | 'user_hangup'
    | 'peer_hangup'
    | 'peer_disconnected'
    | 'match_timeout'
    | 'moderation'
    | 'system_error';
}
