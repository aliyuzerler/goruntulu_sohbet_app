import { Module, Global } from '@nestjs/common';
import { BanEvasionService } from './ban-evasion.service';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [BanEvasionService],
  exports: [BanEvasionService],
})
export class BanEvasionModule {}
