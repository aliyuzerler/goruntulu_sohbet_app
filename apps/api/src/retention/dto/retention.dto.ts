import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

class ClaimDailyDto {}

class CreateReferralDto {
  @IsString()
  @MaxLength(16)
  inviteCode!: string;
}

class AdRewardDto {
  @IsOptional()
  @IsString()
  adUnitId?: string;
}

class GiftDto {
  @IsUUID()
  callId!: string;

  @IsUUID()
  recipientId!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  amount!: number;
}

class ReconnectDto {
  @IsUUID()
  lastCallId!: string;
}

export { ClaimDailyDto, CreateReferralDto, AdRewardDto, GiftDto, ReconnectDto };
