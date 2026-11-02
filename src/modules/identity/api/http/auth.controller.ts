import { randomBytes } from 'node:crypto';
import { Body, Controller, Get, HttpCode, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { IdentityService } from '../../application/identity.service';
import { ZodValidationPipe } from '../../../../platform/validation/zod-validation.pipe';
import { JwtGuard, AuthenticatedUser } from '../../../../platform/auth/jwt.guard';
import { CurrentUser } from '../../../../platform/auth/current-user.decorator';
import { DefaultRateLimitGuard } from '../../../../platform/rate-limit/default-rate-limit.guard';
import { toHttpException } from '../../../../shared/errors/to-http-exception';
import { appConfig } from '../../../../config/app.config';
import { RegisterSchema, RegisterDto } from './dto/register.dto';
import { RegisterResult } from '../../application/commands/register.usecase';
import { LoginSchema, LoginDto } from './dto/login.dto';
import { AuthResult } from '../../application/commands/login.usecase';
import { RefreshSchema, RefreshDto } from './dto/refresh.dto';
import { LogoutSchema, LogoutDto } from './dto/logout.dto';
import { VerifyEmailSchema, VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordSchema, ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordSchema, ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordSchema, ChangePasswordDto } from './dto/change-password.dto';
import { RequestEmailChangeSchema, RequestEmailChangeDto } from './dto/request-email-change.dto';
import { ConfirmEmailChangeSchema, ConfirmEmailChangeDto } from './dto/confirm-email-change.dto';
import { OAuthGoogleSchema, OAuthGoogleDto } from './dto/oauth-google.dto';
import { OAuthAppleSchema, OAuthAppleDto } from './dto/oauth-apple.dto';
import { GoogleCallbackQuerySchema, GoogleCallbackQueryDto } from './dto/google-callback.dto';
import {
  AppleCallbackSchema,
  AppleCallbackDto,
  extractAppleFullName,
} from './dto/apple-callback.dto';
import { ExchangeOAuthCodeSchema, ExchangeOAuthCodeDto } from './dto/exchange-oauth-code.dto';
import { buildGoogleAuthorizeUrl } from '../../infra/oauth/google-authorize-url';
import { buildAppleAuthorizeUrl } from '../../infra/oauth/apple-authorize-url';

@Controller('auth')
export class AuthController {
  constructor(private readonly identity: IdentityService) {}

  @Post('register')
  async register(
    @Body(new ZodValidationPipe(RegisterSchema)) dto: RegisterDto,
    @Req() req: FastifyRequest,
  ): Promise<{ data: RegisterResult }> {
    const result = await this.identity.register({ ...dto, ipAddress: req.ip });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto,
    @Req() req: FastifyRequest,
  ): Promise<{ data: AuthResult }> {
    const userAgent = req.headers['user-agent'];
    const result = await this.identity.login({
      email: dto.email,
      password: dto.password,
      ipAddress: req.ip,
      ...(userAgent !== undefined ? { userAgent } : {}),
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  // Native Google sign-in: expo-auth-session already did the device-side auth dance and hands
  // the resulting id_token straight to the client, which posts it here. Same envelope shape as
  // login/register.
  @Post('google')
  @HttpCode(200)
  async signInWithGoogle(
    @Body(new ZodValidationPipe(OAuthGoogleSchema)) dto: OAuthGoogleDto,
    @Req() req: FastifyRequest,
  ): Promise<{ data: AuthResult }> {
    const userAgent = req.headers['user-agent'];
    const result = await this.identity.signInWithProvider({
      provider: 'GOOGLE',
      idToken: dto.idToken,
      context: 'native',
      ipAddress: req.ip,
      ...(userAgent !== undefined ? { userAgent } : {}),
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  // Native Apple sign-in: expo-apple-authentication hands the client an identityToken (plus, on
  // this Apple ID's first-ever authorization for this app, a real name — captured by the client
  // and forwarded here since no later sign-in will ever see it again).
  @Post('apple')
  @HttpCode(200)
  async signInWithApple(
    @Body(new ZodValidationPipe(OAuthAppleSchema)) dto: OAuthAppleDto,
    @Req() req: FastifyRequest,
  ): Promise<{ data: AuthResult }> {
    const userAgent = req.headers['user-agent'];
    const result = await this.identity.signInWithProvider({
      provider: 'APPLE',
      idToken: dto.identityToken,
      context: 'native',
      ipAddress: req.ip,
      ...(dto.fullName !== undefined ? { fallbackDisplayName: dto.fullName } : {}),
      ...(userAgent !== undefined ? { userAgent } : {}),
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  // Web Google sign-in, step 1 of 2: the browser is sent straight here (no SDK on the frontend
  // for the web path), and this redirects on to Google's own consent screen.
  @Get('google')
  startGoogleWeb(@Res() res: FastifyReply): void {
    const state = randomBytes(16).toString('hex');
    const url = buildGoogleAuthorizeUrl(state);
    if (!url) {
      res.code(302).redirect(`${appConfig.publicAppUrl}/?oauthError=not_configured`);
      return;
    }
    res.code(302).redirect(url);
  }

  // Web Google sign-in, step 2 of 2: Google redirects the browser back here with an
  // authorization code. Exchanges it, signs in/up/links exactly like every other entry point,
  // then hands the browser a one-time code instead of real tokens (see
  // OAuthExchangeCodeService) and sends it on to the web app's own callback page.
  @Get('google/callback')
  async finishGoogleWeb(
    @Query(new ZodValidationPipe(GoogleCallbackQuerySchema)) query: GoogleCallbackQueryDto,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ): Promise<void> {
    if (!query.code) {
      res.code(302).redirect(`${appConfig.publicAppUrl}/?oauthError=${query.error ?? 'denied'}`);
      return;
    }
    const userAgent = req.headers['user-agent'];
    const result = await this.identity.completeOAuthWebCallback({
      provider: 'GOOGLE',
      code: query.code,
      ipAddress: req.ip,
      ...(userAgent !== undefined ? { userAgent } : {}),
    });
    if (!result.ok) {
      res.code(302).redirect(`${appConfig.publicAppUrl}/?oauthError=${result.error.code}`);
      return;
    }
    const exchangeCode = await this.identity.issueOAuthExchangeCode(result.value);
    res.code(302).redirect(`${appConfig.publicAppUrl}/auth/callback?code=${exchangeCode}`);
  }

  // Web Apple sign-in, step 1 of 2 — same shape as startGoogleWeb above.
  @Get('apple')
  startAppleWeb(@Res() res: FastifyReply): void {
    const state = randomBytes(16).toString('hex');
    const url = buildAppleAuthorizeUrl(state);
    if (!url) {
      res.code(302).redirect(`${appConfig.publicAppUrl}/?oauthError=not_configured`);
      return;
    }
    res.code(302).redirect(url);
  }

  // Web Apple sign-in, step 2 of 2 — Apple POSTs here (response_mode=form_post is mandatory
  // once name/email scopes are requested, so this can't be a GET like Google's callback).
  @Post('apple/callback')
  @HttpCode(200)
  async finishAppleWeb(
    @Body(new ZodValidationPipe(AppleCallbackSchema)) dto: AppleCallbackDto,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ): Promise<void> {
    const userAgent = req.headers['user-agent'];
    const fullName = extractAppleFullName(dto.user);
    const result = await this.identity.completeOAuthWebCallback({
      provider: 'APPLE',
      code: dto.code,
      ipAddress: req.ip,
      ...(fullName !== undefined ? { fallbackDisplayName: fullName } : {}),
      ...(userAgent !== undefined ? { userAgent } : {}),
    });
    if (!result.ok) {
      res.code(302).redirect(`${appConfig.publicAppUrl}/?oauthError=${result.error.code}`);
      return;
    }
    const exchangeCode = await this.identity.issueOAuthExchangeCode(result.value);
    res.code(302).redirect(`${appConfig.publicAppUrl}/auth/callback?code=${exchangeCode}`);
  }

  // Web sign-in, final step: the web app's own callback page (not a backend route — see
  // AuthProvider.tsx) lands with ?code=<exchangeCode> and trades it here for the real tokens a
  // native sign-in would have gotten directly.
  @Post('exchange-code')
  @HttpCode(200)
  async exchangeOAuthCode(
    @Body(new ZodValidationPipe(ExchangeOAuthCodeSchema)) dto: ExchangeOAuthCodeDto,
  ): Promise<{ data: AuthResult }> {
    const result = await this.identity.exchangeOAuthCode(dto);
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Body(new ZodValidationPipe(RefreshSchema)) dto: RefreshDto,
  ): Promise<{ data: AuthResult }> {
    const result = await this.identity.refresh(dto);
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async logout(
    @Body(new ZodValidationPipe(LogoutSchema)) dto: LogoutDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: { loggedOut: true } }> {
    const result = await this.identity.logout({ userId: user.id, refreshToken: dto.refreshToken });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Post('verify-email')
  @HttpCode(200)
  async verifyEmail(
    @Body(new ZodValidationPipe(VerifyEmailSchema)) dto: VerifyEmailDto,
    @Req() req: FastifyRequest,
  ): Promise<{ data: { verified: true } }> {
    const result = await this.identity.verifyEmail({ ...dto, ipAddress: req.ip });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(
    @Body(new ZodValidationPipe(ForgotPasswordSchema)) dto: ForgotPasswordDto,
  ): Promise<{ data: { sent: true } }> {
    const result = await this.identity.requestPasswordReset(dto);
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(
    @Body(new ZodValidationPipe(ResetPasswordSchema)) dto: ResetPasswordDto,
  ): Promise<{ data: { reset: true } }> {
    const result = await this.identity.resetPassword(dto);
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async changePassword(
    @Body(new ZodValidationPipe(ChangePasswordSchema)) dto: ChangePasswordDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ): Promise<{ data: AuthResult }> {
    const userAgent = req.headers['user-agent'];
    const result = await this.identity.changePassword({
      userId: user.id,
      currentPassword: dto.currentPassword,
      newPassword: dto.newPassword,
      ipAddress: req.ip,
      ...(userAgent !== undefined ? { userAgent } : {}),
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  // Step 1 of 2 — see confirmEmailChange below. Nothing on the account changes here.
  @Post('request-email-change')
  @HttpCode(200)
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async requestEmailChange(
    @Body(new ZodValidationPipe(RequestEmailChangeSchema)) dto: RequestEmailChangeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: { sent: true } }> {
    const result = await this.identity.requestEmailChange({
      userId: user.id,
      currentPassword: dto.currentPassword,
      newEmail: dto.newEmail,
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  // Step 2 of 2. Public, same trust model as verify-email/reset-password: the token itself is the
  // authorization, not the caller's current session (the link may be opened signed out).
  @Post('confirm-email-change')
  @HttpCode(200)
  async confirmEmailChange(
    @Body(new ZodValidationPipe(ConfirmEmailChangeSchema)) dto: ConfirmEmailChangeDto,
    @Req() req: FastifyRequest,
  ): Promise<{ data: AuthResult }> {
    const userAgent = req.headers['user-agent'];
    const result = await this.identity.confirmEmailChange({
      token: dto.token,
      ...(userAgent !== undefined ? { userAgent } : {}),
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }
}
