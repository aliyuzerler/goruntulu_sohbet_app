import { Module } from '@nestjs/common';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';
import { AgoraService } from './agora.service';

@Module({
  controllers: [CallsController],
  providers: [CallsService, AgoraService],
  exports: [CallsService, AgoraService],
})
export class CallsModule {}
