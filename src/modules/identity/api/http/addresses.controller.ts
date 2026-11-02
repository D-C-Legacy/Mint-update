import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IdentityService } from '../../application/identity.service';
import { JwtGuard, AuthenticatedUser } from '../../../../platform/auth/jwt.guard';
import { CurrentUser } from '../../../../platform/auth/current-user.decorator';
import { DefaultRateLimitGuard } from '../../../../platform/rate-limit/default-rate-limit.guard';
import { ZodValidationPipe } from '../../../../platform/validation/zod-validation.pipe';
import { toHttpException } from '../../../../shared/errors/to-http-exception';
import { Address } from '../../domain/entities/address.entity';
import {
  CreateAddressSchema,
  CreateAddressDto,
  UpdateAddressSchema,
  UpdateAddressDto,
} from './dto/address.dto';

interface AddressView {
  id: string;
  fullName: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  isDefault: boolean;
}

function toAddressView(address: Address): AddressView {
  return {
    id: address.id,
    fullName: address.fullName,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    region: address.region,
    postalCode: address.postalCode,
    countryCode: address.countryCode,
    isDefault: address.isDefault,
  };
}

// The buyer's saved address book. Not in 05-API-SPEC.md: added for app integration Phase 3 on the
// user's instruction. The spec only has the per-order address (`POST /orders/:id/address`).
@Controller('me/addresses')
@UseGuards(JwtGuard, DefaultRateLimitGuard)
export class AddressesController {
  constructor(private readonly identity: IdentityService) {}

  @Get()
  async list(@CurrentUser() current: AuthenticatedUser): Promise<{ data: unknown }> {
    const addresses = await this.identity.listAddresses({ userId: current.id });
    return { data: { items: addresses.map(toAddressView) } };
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(CreateAddressSchema)) dto: CreateAddressDto,
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const { isDefault, line2, ...rest } = dto;
    const result = await this.identity.addAddress({
      userId: current.id,
      fields: { ...rest, line2: line2 ?? null },
      makeDefault: isDefault ?? false,
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: toAddressView(result.value) };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateAddressSchema)) dto: UpdateAddressDto,
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const { isDefault, ...patch } = dto;
    const result = await this.identity.updateAddress({
      userId: current.id,
      addressId: id,
      patch,
      makeDefault: isDefault === true,
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: toAddressView(result.value) };
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(
    @Param('id') id: string,
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.identity.removeAddress({ userId: current.id, addressId: id });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }
}
