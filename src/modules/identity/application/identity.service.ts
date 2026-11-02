import { Injectable } from '@nestjs/common';
import { Result } from '../../../shared/result/result';
import { RegisterUseCase, RegisterCommand, RegisterResult } from './commands/register.usecase';
import { LoginUseCase, LoginCommand, AuthResult } from './commands/login.usecase';
import { RefreshUseCase, RefreshCommand } from './commands/refresh.usecase';
import { LogoutUseCase, LogoutCommand } from './commands/logout.usecase';
import { VerifyEmailUseCase, VerifyEmailCommand } from './commands/verify-email.usecase';
import {
  RequestPasswordResetUseCase,
  RequestPasswordResetCommand,
} from './commands/request-password-reset.usecase';
import { ResetPasswordUseCase, ResetPasswordCommand } from './commands/reset-password.usecase';
import { UpdateProfileUseCase, UpdateProfileCommand } from './commands/update-profile.usecase';
import {
  RequestAvatarUploadUseCase,
  RequestAvatarUploadCommand,
  RequestAvatarUploadResult,
} from './commands/request-avatar-upload.usecase';
import { ChangePasswordUseCase, ChangePasswordCommand } from './commands/change-password.usecase';
import {
  RequestEmailChangeUseCase,
  RequestEmailChangeCommand,
} from './commands/request-email-change.usecase';
import {
  ConfirmEmailChangeUseCase,
  ConfirmEmailChangeCommand,
} from './commands/confirm-email-change.usecase';
import { GetPreferencesUseCase, GetPreferencesCommand } from './commands/get-preferences.usecase';
import {
  UpdatePreferencesUseCase,
  UpdatePreferencesCommand,
} from './commands/update-preferences.usecase';
import { RegisterDeviceUseCase, RegisterDeviceCommand } from './commands/register-device.usecase';
import { RemoveDeviceUseCase, RemoveDeviceCommand } from './commands/remove-device.usecase';
import { ListAddressesUseCase, ListAddressesCommand } from './commands/list-addresses.usecase';
import { AddAddressUseCase, AddAddressCommand } from './commands/add-address.usecase';
import { UpdateAddressUseCase, UpdateAddressCommand } from './commands/update-address.usecase';
import { RemoveAddressUseCase, RemoveAddressCommand } from './commands/remove-address.usecase';
import { GetUserByIdQuery, GetUserByIdCommand } from './queries/get-user-by-id.query';
import { GetDeviceTokensQuery, GetDeviceTokensCommand } from './queries/get-device-tokens.query';
import {
  SignInWithProviderUseCase,
  SignInWithProviderCommand,
} from './commands/sign-in-with-provider.usecase';
import {
  CompleteOAuthWebCallbackUseCase,
  CompleteOAuthWebCallbackCommand,
} from './commands/complete-oauth-web-callback.usecase';
import {
  ExchangeOAuthCodeUseCase,
  ExchangeOAuthCodeCommand,
} from './commands/exchange-oauth-code.usecase';
import { OAuthExchangeCodeService } from '../infra/oauth/oauth-exchange-code.service';
import {
  RequestAccountDeletionUseCase,
  RequestAccountDeletionCommand,
  RequestAccountDeletionResult,
} from './commands/request-account-deletion.usecase';
import {
  CancelAccountDeletionUseCase,
  CancelAccountDeletionCommand,
} from './commands/cancel-account-deletion.usecase';
import {
  AccountDeletionAlreadyPendingError,
  AccountDeletionNotPendingError,
  AddressLimitReachedError,
  AddressNotFoundError,
  CurrentPasswordIncorrectError,
  DeviceNotFoundError,
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  InvalidStorageKeyError,
  InvalidTokenError,
  LoginRateLimitedError,
  OAuthRateLimitedError,
  OAuthTokenInvalidError,
  PhoneAlreadyInUseError,
  RegisterRateLimitedError,
  UploadRateLimitedError,
  VerifyEmailRateLimitedError,
} from '../domain/errors/identity.errors';
import { InvalidUploadError } from '../../../platform/storage/upload-policy';
import { User } from '../domain/entities/user.entity';
import { Device } from '../domain/entities/device.entity';
import { Address } from '../domain/entities/address.entity';
import { UserPreferences } from '../domain/entities/user-preferences.entity';

@Injectable()
export class IdentityService {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshUseCase: RefreshUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly verifyEmailUseCase: VerifyEmailUseCase,
    private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
    private readonly updateProfileUseCase: UpdateProfileUseCase,
    private readonly requestAvatarUploadUseCase: RequestAvatarUploadUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
    private readonly requestEmailChangeUseCase: RequestEmailChangeUseCase,
    private readonly confirmEmailChangeUseCase: ConfirmEmailChangeUseCase,
    private readonly getPreferencesUseCase: GetPreferencesUseCase,
    private readonly updatePreferencesUseCase: UpdatePreferencesUseCase,
    private readonly registerDeviceUseCase: RegisterDeviceUseCase,
    private readonly removeDeviceUseCase: RemoveDeviceUseCase,
    private readonly listAddressesUseCase: ListAddressesUseCase,
    private readonly addAddressUseCase: AddAddressUseCase,
    private readonly updateAddressUseCase: UpdateAddressUseCase,
    private readonly removeAddressUseCase: RemoveAddressUseCase,
    private readonly getUserByIdQuery: GetUserByIdQuery,
    private readonly getDeviceTokensQuery: GetDeviceTokensQuery,
    private readonly signInWithProviderUseCase: SignInWithProviderUseCase,
    private readonly completeOAuthWebCallbackUseCase: CompleteOAuthWebCallbackUseCase,
    private readonly exchangeOAuthCodeUseCase: ExchangeOAuthCodeUseCase,
    private readonly oauthExchangeCodes: OAuthExchangeCodeService,
    private readonly requestAccountDeletionUseCase: RequestAccountDeletionUseCase,
    private readonly cancelAccountDeletionUseCase: CancelAccountDeletionUseCase,
  ) {}

  async register(
    cmd: RegisterCommand,
  ): Promise<Result<RegisterResult, EmailAlreadyRegisteredError | RegisterRateLimitedError>> {
    return this.registerUseCase.execute(cmd);
  }

  async login(
    cmd: LoginCommand,
  ): Promise<Result<AuthResult, InvalidCredentialsError | LoginRateLimitedError>> {
    return this.loginUseCase.execute(cmd);
  }

  async refresh(cmd: RefreshCommand): Promise<Result<AuthResult, InvalidTokenError>> {
    return this.refreshUseCase.execute(cmd);
  }

  async logout(cmd: LogoutCommand): Promise<Result<{ loggedOut: true }, InvalidTokenError>> {
    return this.logoutUseCase.execute(cmd);
  }

  async verifyEmail(
    cmd: VerifyEmailCommand,
  ): Promise<Result<{ verified: true }, InvalidTokenError | VerifyEmailRateLimitedError>> {
    return this.verifyEmailUseCase.execute(cmd);
  }

  async requestPasswordReset(
    cmd: RequestPasswordResetCommand,
  ): Promise<Result<{ sent: true }, never>> {
    return this.requestPasswordResetUseCase.execute(cmd);
  }

  async resetPassword(
    cmd: ResetPasswordCommand,
  ): Promise<Result<{ reset: true }, InvalidTokenError>> {
    return this.resetPasswordUseCase.execute(cmd);
  }

  async updateProfile(
    cmd: UpdateProfileCommand,
  ): Promise<Result<User, InvalidTokenError | InvalidStorageKeyError | PhoneAlreadyInUseError>> {
    return this.updateProfileUseCase.execute(cmd);
  }

  async requestAvatarUpload(
    cmd: RequestAvatarUploadCommand,
  ): Promise<Result<RequestAvatarUploadResult, UploadRateLimitedError | InvalidUploadError>> {
    return this.requestAvatarUploadUseCase.execute(cmd);
  }

  async changePassword(
    cmd: ChangePasswordCommand,
  ): Promise<
    Result<AuthResult, InvalidTokenError | CurrentPasswordIncorrectError | LoginRateLimitedError>
  > {
    return this.changePasswordUseCase.execute(cmd);
  }

  async requestEmailChange(
    cmd: RequestEmailChangeCommand,
  ): Promise<
    Result<
      { sent: true },
      InvalidTokenError | CurrentPasswordIncorrectError | EmailAlreadyRegisteredError
    >
  > {
    return this.requestEmailChangeUseCase.execute(cmd);
  }

  async confirmEmailChange(
    cmd: ConfirmEmailChangeCommand,
  ): Promise<Result<AuthResult, InvalidTokenError | EmailAlreadyRegisteredError>> {
    return this.confirmEmailChangeUseCase.execute(cmd);
  }

  async getPreferences(cmd: GetPreferencesCommand): Promise<UserPreferences> {
    return this.getPreferencesUseCase.execute(cmd);
  }

  async updatePreferences(cmd: UpdatePreferencesCommand): Promise<UserPreferences> {
    return this.updatePreferencesUseCase.execute(cmd);
  }

  async registerDevice(cmd: RegisterDeviceCommand): Promise<Device> {
    return this.registerDeviceUseCase.execute(cmd);
  }

  async removeDevice(
    cmd: RemoveDeviceCommand,
  ): Promise<Result<{ removed: true }, DeviceNotFoundError>> {
    return this.removeDeviceUseCase.execute(cmd);
  }

  async listAddresses(cmd: ListAddressesCommand): Promise<Address[]> {
    return this.listAddressesUseCase.execute(cmd);
  }

  async addAddress(cmd: AddAddressCommand): Promise<Result<Address, AddressLimitReachedError>> {
    return this.addAddressUseCase.execute(cmd);
  }

  async updateAddress(cmd: UpdateAddressCommand): Promise<Result<Address, AddressNotFoundError>> {
    return this.updateAddressUseCase.execute(cmd);
  }

  async removeAddress(
    cmd: RemoveAddressCommand,
  ): Promise<Result<{ removed: true }, AddressNotFoundError>> {
    return this.removeAddressUseCase.execute(cmd);
  }

  async getUserById(cmd: GetUserByIdCommand): Promise<User | null> {
    return this.getUserByIdQuery.execute(cmd);
  }

  async getDeviceTokens(cmd: GetDeviceTokensCommand): Promise<string[]> {
    return this.getDeviceTokensQuery.execute(cmd);
  }

  async signInWithProvider(
    cmd: SignInWithProviderCommand,
  ): Promise<
    Result<AuthResult, InvalidCredentialsError | OAuthTokenInvalidError | OAuthRateLimitedError>
  > {
    return this.signInWithProviderUseCase.execute(cmd);
  }

  async completeOAuthWebCallback(
    cmd: CompleteOAuthWebCallbackCommand,
  ): Promise<
    Result<AuthResult, InvalidCredentialsError | OAuthTokenInvalidError | OAuthRateLimitedError>
  > {
    return this.completeOAuthWebCallbackUseCase.execute(cmd);
  }

  async exchangeOAuthCode(
    cmd: ExchangeOAuthCodeCommand,
  ): Promise<Result<AuthResult, InvalidTokenError>> {
    return this.exchangeOAuthCodeUseCase.execute(cmd);
  }

  // Mints the short-lived one-time code a web OAuth callback redirects the browser with — see
  // OAuthExchangeCodeService's own comment for why real tokens never ride in that redirect URL.
  async issueOAuthExchangeCode(result: AuthResult): Promise<string> {
    return this.oauthExchangeCodes.issue(result);
  }

  // Apple App Store guideline 5.1.1(v) account-deletion feature. Deliberately the only entry
  // point into identity's own deletion-scheduling state — modules/account-deletion calls these
  // after it has already decided the caller is eligible; see request-account-deletion.usecase.ts
  // for why that decision can't be made inside identity itself.
  async requestAccountDeletion(
    cmd: RequestAccountDeletionCommand,
  ): Promise<
    Result<RequestAccountDeletionResult, InvalidTokenError | AccountDeletionAlreadyPendingError>
  > {
    return this.requestAccountDeletionUseCase.execute(cmd);
  }

  async cancelAccountDeletion(
    cmd: CancelAccountDeletionCommand,
  ): Promise<Result<{ cancelled: true }, InvalidTokenError | AccountDeletionNotPendingError>> {
    return this.cancelAccountDeletionUseCase.execute(cmd);
  }
}
