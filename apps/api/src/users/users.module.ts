import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ProfanityService } from './profanity.service';
import { DeletionService } from './deletion.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, ProfanityService, DeletionService],
  exports: [UsersService],
})
export class UsersModule {}
