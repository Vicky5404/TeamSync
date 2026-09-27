import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';

import { RealtimeGateway } from './realtime.gateway.js';

/** WebSocket endpoint — only loaded by the API process (workers publish via Redis). */
@Module({
  imports: [AuthModule],
  providers: [RealtimeGateway],
})
export class RealtimeGatewayModule {}
