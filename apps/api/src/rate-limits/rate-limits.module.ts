import { Module, Global } from '@nestjs/common';
import { RateLimitExtensionsService } from './rate-limit-extensions.service';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [RateLimitExtensionsService],
  exports: [RateLimitExtensionsService],
})
export class RateLimitExtensionsModule {}
