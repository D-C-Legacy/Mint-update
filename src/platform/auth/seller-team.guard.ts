import { CanActivate, ExecutionContext, Injectable, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CustomDecorator, SetMetadata } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AuthenticatedUser } from './jwt.guard';
import { ForbiddenHttpException } from '../../shared/errors/guard.exception';
import { SellersService } from '../../modules/sellers/application/sellers.service';
// Team role type comes through the sellers application facade, not the domain entity — the
// import-boundary rule only sanctions facade imports outside the owning module.
import type { SellerTeamRole } from '../../modules/sellers/application/sellers.service';

export const SELLER_TEAM_ROLES_KEY = 'sellerTeamRoles';
export const SellerTeamRoles = (...roles: SellerTeamRole[]): CustomDecorator<string> =>
  SetMetadata(SELLER_TEAM_ROLES_KEY, roles);

@Injectable()
export class SellerTeamGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(SellersService) private readonly sellers: SellersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<SellerTeamRole[]>(
      SELLER_TEAM_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { user?: AuthenticatedUser }>();
    if (!request.user) {
      throw new ForbiddenHttpException();
    }

    // Get the seller for the current user
    const sellerResult = await this.sellers.getMySeller({ userId: request.user.id });
    if (!sellerResult.ok) {
      throw new ForbiddenHttpException();
    }

    const sellerId = sellerResult.value.seller.id;

    // Check team membership with required roles
    const teamCheck = await this.sellers.checkTeamMembership({
      userId: request.user.id,
      sellerId,
      requiredRoles,
    });

    if (!teamCheck.ok) {
      throw new ForbiddenHttpException();
    }

    return true;
  }
}
