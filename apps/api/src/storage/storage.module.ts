import { Module, Global } from '@nestjs/common';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';

/**
 * StorageModule — provides S3-compatible presigned URL generation.
 * Used by avatar upload (Phase 2), moderation frame upload (Phase 4),
 * and admin asset upload (Phase 8).
 */
@Global()
@Module({
  controllers: [StorageController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
