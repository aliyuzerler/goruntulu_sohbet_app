import { Module, Global } from '@nestjs/common';
import { GdprController } from './gdpr.controller';
import { GdprService } from './gdpr.service';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [GdprController],
  providers: [GdprService],
  exports: [GdprService],
})
export class GdprModule {}
