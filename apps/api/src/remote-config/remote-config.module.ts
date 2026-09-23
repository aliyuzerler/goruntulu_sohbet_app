import { Module, Global } from '@nestjs/common';
import { RemoteConfigController } from './remote-config.controller';
import { RemoteConfigService } from './remote-config.service';

@Global()
@Module({
  controllers: [RemoteConfigController],
  providers: [RemoteConfigService],
  exports: [RemoteConfigService],
})
export class RemoteConfigModule {}
