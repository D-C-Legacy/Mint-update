import { Module } from '@nestjs/common';
import { PasswordService } from './password.service';
import { JwtService } from './jwt.service';
import { RefreshTokenService } from './refresh-token.service';
import { JwtGuard } from './jwt.guard';
import { OptionalJwtGuard } from './optional-jwt.guard';
import { RolesGuard } from './roles.guard';
import { WsAuthGuard } from './ws-auth.guard';

// NOTE: SellerTeamGuard is deliberately NOT registered here. It injects SellersService, so it is
// provided by SellersModule — registering it in AuthModule would require AuthModule to import
// SellersModule, a platform -> business-module edge that also closes a dependency cycle.
@Module({
  providers: [
    PasswordService,
    JwtService,
    RefreshTokenService,
    JwtGuard,
    OptionalJwtGuard,
    RolesGuard,
    WsAuthGuard,
  ],
  exports: [
    PasswordService,
    JwtService,
    RefreshTokenService,
    JwtGuard,
    OptionalJwtGuard,
    RolesGuard,
    WsAuthGuard,
  ],
})
export class AuthModule {}
