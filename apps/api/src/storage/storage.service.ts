import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

/**
 * StorageService — S3-compatible (MinIO in dev) presigned URL generator.
 * Lifecycle: lazy S3Client creation (Phase 1 scaffold pattern).
 *
 * Phase 2 only exposes `presignAvatarPut`. Phase 4 will add `presignModerationFramePut`.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = config.get<string>('S3_BUCKET')!;
    this.publicBaseUrl = config.get<string>('S3_PUBLIC_BASE_URL')!;
    this.client = new S3Client({
      endpoint: config.get<string>('S3_ENDPOINT'),
      region: config.get<string>('S3_REGION') ?? 'us-east-1',
      credentials: {
        accessKeyId: config.get<string>('S3_ACCESS_KEY')!,
        secretAccessKey: config.get<string>('S3_SECRET_KEY')!,
      },
      forcePathStyle: config.get<boolean>('S3_FORCE_PATH_STYLE') ?? true,
    });
  }

  /**
   * Generate a presigned PUT URL for an avatar upload.
   * Returns the URL + the public URL the client should use to display the
   * uploaded image (so the client doesn't need to know the bucket name).
   *
   * Path layout: `avatars/{userId}/{uuid}.{ext}` — prefixed by user so we can
   * easily audit/quota per-user uploads.
   */
  async presignAvatarPut(opts: {
    userId: string;
    contentType: string;
    ext: string;
    maxSizeBytes: number;
  }): Promise<{ uploadUrl: string; publicUrl: string; objectKey: string }> {
    // Validate content type — only common image types accepted.
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(opts.contentType)) {
      throw new Error(`Unsupported avatar content type: ${opts.contentType}`);
    }
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(opts.ext.toLowerCase())) {
      throw new Error(`Unsupported avatar extension: ${opts.ext}`);
    }
    if (opts.maxSizeBytes > 5 * 1024 * 1024) {
      throw new Error('Avatar max size is 5MB');
    }

    const key = `avatars/${opts.userId}/${randomUUID()}.${opts.ext}`;
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: opts.contentType,
      ContentLength: opts.maxSizeBytes,
    });
    // 5-minute presigned window — plenty for an upload from a phone.
    const uploadUrl = await getSignedUrl(this.client, cmd, {
      expiresIn: 300,
    });
    const publicUrl = `${this.publicBaseUrl}/${key}`;
    return { uploadUrl, publicUrl, objectKey: key };
  }

  /**
   * Verify the bucket exists / is reachable. Used by /health storage indicator.
   * Phase 1 left a copy of this in storage.health.ts; we'll consolidate later.
   */
  async pingBucket(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch (err) {
      this.logger.warn(`Bucket ping failed: ${(err as Error).message}`);
      return false;
    }
  }
}
