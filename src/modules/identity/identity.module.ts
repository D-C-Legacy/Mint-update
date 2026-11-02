import { Module } from '@nestjs/common';
import { env } from '../../config/env';
import { DatabaseModule } from '../../platform/database/database.module';
import { AuthModule } from '../../platform/auth/auth.module';
import { RateLimitModule } from '../../platform/rate-limit/rate-limit.module';
import { StorageModule } from '../../platform/storage/storage.module';
import { EventsModule } from '../../platform/events/events.module';
import { RedisModule } from '../../platform/redis/redis.module';
import { QueueModule } from '../../platform/queue/queue.module';
import { USER_REPOSITORY } from './domain/ports/user.repository.port';
import { SESSION_REPOSITORY } from './domain/ports/session.repository.port';
import { DEVICE_REPOSITORY } from './domain/ports/device.repository.port';
import { USER_PREFERENCES_REPOSITORY } from './domain/ports/user-preferences.repository.port';
import { ADDRESS_REPOSITORY } from './domain/ports/address.repository.port';
import { OAUTH_IDENTITY_REPOSITORY } from './domain/ports/oauth-identity.repository.port';
import { CLOCK, SystemClock } from '../../shared/time/clock';
import { EMAIL_NOTIFIER } from './application/ports/email-notifier.port';
import {
  GOOGLE_OAUTH_VERIFIER,
  APPLE_OAUTH_VERIFIER,
} from './application/ports/oauth-verifier.port';
import {
  GOOGLE_OAUTH_CODE_EXCHANGER,
  APPLE_OAUTH_CODE_EXCHANGER,
} from './application/ports/oauth-code-exchanger.port';
import { UserPrismaRepository } from './infra/repositories/user.prisma.repository';
import { SessionPrismaRepository } from './infra/repositories/session.prisma.repository';
import { DevicePrismaRepository } from './infra/repositories/device.prisma.repository';
import { UserPreferencesPrismaRepository } from './infra/repositories/user-preferences.prisma.repository';
import { AddressPrismaRepository } from './infra/repositories/address.prisma.repository';
import { OAuthIdentityPrismaRepository } from './infra/repositories/oauth-identity.prisma.repository';
import { ConsoleEmailNotifier } from './infra/notifications/console-email-notifier';
import { ResendEmailNotifier } from './infra/notifications/resend-email-notifier';
import { EmailVerificationCodeService } from './infra/notifications/email-verification-code.service';
import { OAuthExchangeCodeService } from './infra/oauth/oauth-exchange-code.service';
import { GoogleOAuthVerifier } from './infra/oauth/google.verifier';
import { AppleOAuthVerifier } from './infra/oauth/apple.verifier';
import { GoogleOAuthCodeExchanger } from './infra/oauth/google-code-exchange';
import { AppleOAuthCodeExchanger } from './infra/oauth/apple-code-exchange';
import { RegisterUseCase } from './application/commands/register.usecase';
import { LoginUseCase } from './application/commands/login.usecase';
import { RefreshUseCase } from './application/commands/refresh.usecase';
import { LogoutUseCase } from './application/commands/logout.usecase';
import { VerifyEmailUseCase } from './application/commands/verify-email.usecase';
import { RequestPasswordResetUseCase } from './application/commands/request-password-reset.usecase';
import { ResetPasswordUseCase } from './application/commands/reset-password.usecase';
import { UpdateProfileUseCase } from './application/commands/update-profile.usecase';
import { RequestAvatarUploadUseCase } from './application/commands/request-avatar-upload.usecase';
import { ChangePasswordUseCase } from './application/commands/change-password.usecase';
import { RequestEmailChangeUseCase } from './application/commands/request-email-change.usecase';
import { ConfirmEmailChangeUseCase } from './application/commands/confirm-email-change.usecase';
import { GetPreferencesUseCase } from './application/commands/get-preferences.usecase';
import { UpdatePreferencesUseCase } from './application/commands/update-preferences.usecase';
import { RegisterDeviceUseCase } from './application/commands/register-device.usecase';
import { RemoveDeviceUseCase } from './application/commands/remove-device.usecase';
import { ListAddressesUseCase } from './application/commands/list-addresses.usecase';
import { AddAddressUseCase } from './application/commands/add-address.usecase';
import { UpdateAddressUseCase } from './application/commands/update-address.usecase';
import { RemoveAddressUseCase } from './application/commands/remove-address.usecase';
import { GetUserByIdQuery } from './application/queries/get-user-by-id.query';
import { GetDeviceTokensQuery } from './application/queries/get-device-tokens.query';
import { SignInWithProviderUseCase } from './application/commands/sign-in-with-provider.usecase';
import { CompleteOAuthWebCallbackUseCase } from './application/commands/complete-oauth-web-callback.usecase';
import { ExchangeOAuthCodeUseCase } from './application/commands/exchange-oauth-code.usecase';
import { RequestAccountDeletionUseCase } from './application/commands/request-account-deletion.usecase';
import { CancelAccountDeletionUseCase } from './application/commands/cancel-account-deletion.usecase';
import { ExecuteAccountDeletionUseCase } from './application/commands/execute-account-deletion.usecase';
import { AccountDeletionProcessor } from './infra/jobs/account-deletion.processor';
import { IdentityService } from './application/identity.service';
import { AuthController } from './api/http/auth.controller';
import { MeController } from './api/http/me.controller';
import { AddressesController } from './api/http/addresses.controller';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    RateLimitModule,
    StorageModule,
    EventsModule,
    RedisModule,
    QueueModule,
  ],
  controllers: [AuthController, MeController, AddressesController],
  providers: [
    { provide: USER_REPOSITORY, useClass: UserPrismaRepository },
    { provide: SESSION_REPOSITORY, useClass: SessionPrismaRepository },
    { provide: DEVICE_REPOSITORY, useClass: DevicePrismaRepository },
    { provide: USER_PREFERENCES_REPOSITORY, useClass: UserPreferencesPrismaRepository },
    { provide: ADDRESS_REPOSITORY, useClass: AddressPrismaRepository },
    { provide: OAUTH_IDENTITY_REPOSITORY, useClass: OAuthIdentityPrismaRepository },
    { provide: GOOGLE_OAUTH_VERIFIER, useClass: GoogleOAuthVerifier },
    { provide: APPLE_OAUTH_VERIFIER, useClass: AppleOAuthVerifier },
    { provide: GOOGLE_OAUTH_CODE_EXCHANGER, useClass: GoogleOAuthCodeExchanger },
    { provide: APPLE_OAUTH_CODE_EXCHANGER, useClass: AppleOAuthCodeExchanger },
    { provide: CLOCK, useClass: SystemClock },
    // Local dev reads the code/token straight from the server log (no real inbox to check);
    // staging/production need it to actually land in an inbox — ConsoleEmailNotifier was
    // unconditionally bound before this, which is almost certainly why verification emails were
    // never actually arriving (founder feedback 24 Oct 2026).
    {
      provide: EMAIL_NOTIFIER,
      useClass: env.NODE_ENV === 'local' ? ConsoleEmailNotifier : ResendEmailNotifier,
    },
    EmailVerificationCodeService,
    OAuthExchangeCodeService,
    SignInWithProviderUseCase,
    CompleteOAuthWebCallbackUseCase,
    ExchangeOAuthCodeUseCase,
    RegisterUseCase,
    LoginUseCase,
    RefreshUseCase,
    LogoutUseCase,
    VerifyEmailUseCase,
    RequestPasswordResetUseCase,
    ResetPasswordUseCase,
    UpdateProfileUseCase,
    RequestAvatarUploadUseCase,
    ChangePasswordUseCase,
    RequestEmailChangeUseCase,
    ConfirmEmailChangeUseCase,
    GetPreferencesUseCase,
    UpdatePreferencesUseCase,
    RegisterDeviceUseCase,
    RemoveDeviceUseCase,
    ListAddressesUseCase,
    AddAddressUseCase,
    UpdateAddressUseCase,
    RemoveAddressUseCase,
    GetUserByIdQuery,
    GetDeviceTokensQuery,
    RequestAccountDeletionUseCase,
    CancelAccountDeletionUseCase,
    ExecuteAccountDeletionUseCase,
    AccountDeletionProcessor,
    IdentityService,
  ],
  exports: [IdentityService],
})
export class IdentityModule {}
