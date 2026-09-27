import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';

import type { AuthUser } from '../../common/auth/auth.types.js';
import { CurrentUser, Public } from '../../common/auth/decorators.js';
import { ApiErrorDto } from '../../common/dto/api-error.dto.js';
import { Errors } from '../../common/errors/api-exception.js';
import { clientContext, requestClient } from '../../common/http/client-context.js';
import { AppConfig } from '../../config/app-config.js';
import { UserDto } from '../users/dto/user.dto.js';

import { AuthService, type SignedInSession } from './auth.service.js';
import {
  AuthSessionDto,
  EmailDto,
  LoginDto,
  RegisterDto,
  RegisterResultDto,
  ResetPasswordDto,
  TokenDto,
} from './dto/auth.dto.js';

const MINUTE = 60_000;

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfig,
  ) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: MINUTE } })
  @ApiOperation({ summary: 'Create an account and send a verification email' })
  @ApiCreatedResponse({ type: RegisterResultDto })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'Email already registered' })
  register(@Body() input: RegisterDto): Promise<RegisterResultDto> {
    return this.auth.register(input);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: MINUTE } })
  @ApiOperation({
    summary: 'Sign in',
    description:
      'Returns an access token and sets the refresh token as an httpOnly cookie scoped to the auth routes.',
  })
  @ApiOkResponse({ type: AuthSessionDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto, description: '`INVALID_CREDENTIALS`' })
  @ApiForbiddenResponse({ type: ApiErrorDto, description: '`EMAIL_NOT_VERIFIED`' })
  @ApiTooManyRequestsResponse({
    type: ApiErrorDto,
    description: '`RATE_LIMITED` or `ACCOUNT_LOCKED`',
  })
  async login(
    @Body() input: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionDto> {
    return this.respondWithSession(response, await this.auth.login(input, clientContext(request)));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: MINUTE } })
  @ApiCookieAuth('refresh-token')
  @ApiOperation({
    summary: 'Exchange the refresh-token cookie for a new access token (rotates the cookie)',
  })
  @ApiOkResponse({ type: AuthSessionDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionDto> {
    this.assertTrustedOrigin(request);
    try {
      return this.respondWithSession(
        response,
        await this.auth.refresh(this.readRefreshCookie(request), clientContext(request)),
      );
    } catch (error) {
      this.clearRefreshCookie(response);
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth('refresh-token')
  @ApiOperation({ summary: 'Revoke the current session and clear the refresh cookie' })
  @ApiNoContentResponse()
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    this.assertTrustedOrigin(request);
    await this.auth.logout(this.readRefreshCookie(request));
    this.clearRefreshCookie(response);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'The authenticated user' })
  @ApiOkResponse({ type: UserDto })
  me(@CurrentUser() user: AuthUser): Promise<UserDto> {
    return this.auth.me(user.id);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 15 * MINUTE } })
  @ApiOperation({ summary: 'Email a password-reset link (always succeeds)' })
  @ApiNoContentResponse()
  forgotPassword(@Body() input: EmailDto): Promise<void> {
    return this.auth.forgotPassword(input.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 15 * MINUTE } })
  @ApiOperation({ summary: 'Set a new password with a reset token; signs out every session' })
  @ApiNoContentResponse()
  resetPassword(@Body() input: ResetPasswordDto, @Req() request: Request): Promise<void> {
    return this.auth.resetPassword(input, requestClient(request));
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 15 * MINUTE } })
  @ApiOperation({ summary: 'Confirm an email address; accepts pending organization invitations' })
  @ApiNoContentResponse()
  verifyEmail(@Body() input: TokenDto): Promise<void> {
    return this.auth.verifyEmail(input.token);
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 15 * MINUTE } })
  @ApiOperation({ summary: 'Resend the verification email (always succeeds)' })
  @ApiNoContentResponse()
  resendVerification(@Body() input: EmailDto): Promise<void> {
    return this.auth.resendVerification(input.email);
  }

  // -------------------------------------------------------------------------

  private respondWithSession(response: Response, session: SignedInSession): AuthSessionDto {
    response.cookie(this.config.auth.cookie.name, session.refreshToken, {
      ...this.cookieOptions(),
      ...(session.cookieMaxAgeMs ? { maxAge: session.cookieMaxAgeMs } : {}),
    });
    response.setHeader('Cache-Control', 'no-store');
    return session.body;
  }

  private clearRefreshCookie(response: Response): void {
    response.clearCookie(this.config.auth.cookie.name, this.cookieOptions());
  }

  private cookieOptions(): CookieOptions {
    const { cookie } = this.config.auth;
    return {
      httpOnly: true,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      path: cookie.path,
      ...(cookie.domain ? { domain: cookie.domain } : {}),
    };
  }

  private readRefreshCookie(request: Request): string | undefined {
    const value: unknown = (request.cookies as Record<string, unknown> | undefined)?.[
      this.config.auth.cookie.name
    ];
    return typeof value === 'string' && value.length > 0 && value.length <= 256 ? value : undefined;
  }

  /**
   * CSRF defence for the cookie-authenticated endpoints: browsers always send
   * `Origin` on cross-origin POSTs, so reject any origin that isn't allowed.
   */
  private assertTrustedOrigin(request: Request): void {
    const origin = request.headers.origin;
    if (origin && !this.config.http.corsOrigins.includes(origin.replace(/\/+$/, ''))) {
      throw Errors.forbidden('Request origin is not allowed.');
    }
  }
}
