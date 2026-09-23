import { Global, Module, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule implements OnModuleInit {
  private readonly logger = new Logger(PrismaModule.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      this.logger.log('✓ Prisma connected to PostgreSQL');
    } catch (err) {
      this.logger.error('✗ Prisma connection failed', err as Error);
      throw err;
    }
  }
}
