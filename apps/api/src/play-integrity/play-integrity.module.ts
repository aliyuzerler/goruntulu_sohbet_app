import { Module, Global } from '@nestjs/common';
import { PlayIntegrityController } from './play-integrity.controller';
import { PlayIntegrityService } from './play-integrity.service';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [PlayIntegrityController],
  providers: [PlayIntegrityService],
  exports: [PlayIntegrityService],
})
export class PlayIntegrityModule {}
