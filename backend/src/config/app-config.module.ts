import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppConfig } from './app-config.js';
import { validateEnv } from './env.validation.js';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      validate: validateEnv,
      // Tests configure everything explicitly; never pick up a developer's .env.
      ignoreEnvFile: process.env.NODE_ENV === 'test',
    }),
  ],
  providers: [AppConfig],
  exports: [AppConfig],
})
export class AppConfigModule {}
