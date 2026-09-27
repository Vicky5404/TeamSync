import { Global, Module } from '@nestjs/common';

import { RealtimePublisher } from './realtime.publisher.js';

/** Event publishing — available to every process (API and workers). */
@Global()
@Module({
  providers: [RealtimePublisher],
  exports: [RealtimePublisher],
})
export class RealtimeModule {}
