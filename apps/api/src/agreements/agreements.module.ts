import { Module } from '@nestjs/common';
import { AgreementsController } from './agreements.controller';
import { AgreementsService } from './agreements.service';

/**
 * AgreementsModule — versioned Terms & Privacy text + per-user acceptance.
 * Used by user_app during the onboarding flow before the user can match.
 */
@Module({
  controllers: [AgreementsController],
  providers: [AgreementsService],
  exports: [AgreementsService],
})
export class AgreementsModule {}
