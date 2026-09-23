import { Body, Controller, Post, UseGuards, Get } from '@nestjs/common';
import { IsIn, IsInt, IsString, Max, Min } from 'class-validator';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

class PresignAvatarDto {
  @IsString()
  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  contentType!: string;

  @IsString()
  @IsIn(['jpg', 'jpeg', 'png', 'webp'])
  ext!: string;

  @IsInt()
  @Min(1024) // at least 1KB
  @Max(5 * 1024 * 1024) // 5MB max
  maxSizeBytes!: number;
}

class PresignResponseDto {
  uploadUrl!: string;
  publicUrl!: string;
  objectKey!: string;
}

/**
 * StorageController — only endpoint in Phase 2 is presign-avatar.
 * Phase 4 will add presign-moderation-frame.
 */
@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  /**
   * POST /api/storage/presign-avatar
   * Returns a presigned PUT URL the client can use to upload its avatar
   * directly to S3 — the API never proxies the binary payload.
   */
  @Post('presign-avatar')
  @UseGuards(JwtAuthGuard)
  async presignAvatar(
    @Body() dto: PresignAvatarDto,
    @CurrentUser() user: { id: string },
  ): Promise<PresignResponseDto> {
    const r = await this.storage.presignAvatarPut({
      userId: user.id,
      contentType: dto.contentType,
      ext: dto.ext,
      maxSizeBytes: dto.maxSizeBytes,
    });
    return {
      uploadUrl: r.uploadUrl,
      publicUrl: r.publicUrl,
      objectKey: r.objectKey,
    };
  }

  /** GET /api/storage/health — quick check for storage reachability. */
  @Get('health')
  async health(): Promise<{ ok: boolean }> {
    return { ok: await this.storage.pingBucket() };
  }
}
