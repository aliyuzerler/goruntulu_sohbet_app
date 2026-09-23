import { Injectable, Logger } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';

/**
 * Storage indicator — runs HeadBucket against the configured S3/MinIO bucket.
 * Phase 1: lazy creates the S3Client per check (cheap; replaced by a global
 * S3 client in Phase 4 when we start uploading moderation frames).
 */
@Injectable()
export class StorageHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(StorageHealthIndicator.name);

  constructor(private readonly config: ConfigService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const start = Date.now();
    const client = new S3Client({
      endpoint: this.config.get<string>('S3_ENDPOINT'),
      region: this.config.get<string>('S3_REGION') ?? 'us-east-1',
      credentials: {
        accessKeyId: this.config.get<string>('S3_ACCESS_KEY')!,
        secretAccessKey: this.config.get<string>('S3_SECRET_KEY')!,
      },
      forcePathStyle: this.config.get<boolean>('S3_FORCE_PATH_STYLE') ?? true,
    });

    try {
      await client.send(
        new HeadBucketCommand({ Bucket: this.config.get<string>('S3_BUCKET')! }),
      );
      const latencyMs = Date.now() - start;
      return this.getStatus(key, true, { latencyMs });
    } catch (err) {
      const latencyMs = Date.now() - start;
      this.logger.warn(`S3 health check failed: ${(err as Error).message}`);
      throw new HealthCheckError(
        `${key} check failed`,
        this.getStatus(key, false, { latencyMs, error: (err as Error).message }),
      );
    } finally {
      client.destroy();
    }
  }
}
