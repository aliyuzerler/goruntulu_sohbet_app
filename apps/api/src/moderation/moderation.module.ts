import { Module, Global } from '@nestjs/common';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { RekognitionService } from './rekognition.service';
import { StrikeService } from './strike.service';
import { NsfwPipelineService } from './nsfw-pipeline.service';
import { ChatFilterService } from './chat-filter.service';
import { RatingService } from './rating.service';
import { UsersModule } from '../users/users.module';
import { BillingModule } from '../billing/billing.module';
import { CallsModule } from '../calls/calls.module';
import { StorageModule } from '../storage/storage.module';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * ModerationModule — Phase 8 moderation + NSFW pipeline + strikes + ratings.
 * Global so matchmaking + socket gateway can inject StrikeService + RatingService.
 */
@Global()
@Module({
  imports: [UsersModule, BillingModule, CallsModule, StorageModule, PrismaModule],
  controllers: [ModerationController],
  providers: [
    ModerationService,
    RekognitionService,
    StrikeService,
    NsfwPipelineService,
    ChatFilterService,
    RatingService,
  ],
  exports: [
    ModerationService,
    StrikeService,
    RatingService,
    ChatFilterService,
  ],
})
export class ModerationModule {}
