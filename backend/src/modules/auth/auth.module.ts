import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AppConfig } from '../../config/app-config.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { UsersModule } from '../users/users.module.js';

import { AccountSecurityController } from './account-security.controller.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { JwtStrategy } from './jwt.strategy.js';
import { LoginAttemptsService } from './login-attempts.service.js';
import { PasswordService } from './password.service.js';
import { SessionsService } from './sessions.service.js';
import { TokenService } from './token.service.js';
import { UserTokensService } from './user-tokens.service.js';

@Module({
  imports: [
    UsersModule,
    OrganizationsModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        secret: config.auth.accessSecret,
        signOptions: {
          algorithm: 'HS256',
          expiresIn: config.auth.accessTtlSeconds,
          issuer: config.auth.issuer,
          audience: config.auth.audience,
        },
        verifyOptions: {
          algorithms: ['HS256'],
          issuer: config.auth.issuer,
          audience: config.auth.audience,
        },
      }),
    }),
  ],
  controllers: [AuthController, AccountSecurityController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    SessionsService,
    UserTokensService,
    LoginAttemptsService,
    JwtStrategy,
    JwtAuthGuard,
  ],
  exports: [TokenService, JwtAuthGuard],
})
export class AuthModule {}
