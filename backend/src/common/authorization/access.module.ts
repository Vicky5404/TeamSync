import { Global, Module } from '@nestjs/common';

import { AccessGuard } from './access.guard.js';
import { AccessResolver } from './access-resolver.service.js';

@Global()
@Module({
  providers: [AccessResolver, AccessGuard],
  exports: [AccessResolver, AccessGuard],
})
export class AccessModule {}
