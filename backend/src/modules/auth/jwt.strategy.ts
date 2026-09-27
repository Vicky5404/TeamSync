import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { AccessTokenPayload, AuthUser } from '../../common/auth/auth.types.js';
import { AppConfig } from '../../config/app-config.js';

import { TokenService } from './token.service.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: AppConfig,
    private readonly tokens: TokenService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.auth.accessSecret,
      algorithms: ['HS256'],
      issuer: config.auth.issuer,
      audience: config.auth.audience,
      ignoreExpiration: false,
    });
  }

  validate(payload: Partial<AccessTokenPayload>): Promise<AuthUser> {
    return this.tokens.validatePayload(payload);
  }
}
