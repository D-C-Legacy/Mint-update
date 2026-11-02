import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { ADDRESS_REPOSITORY, AddressRepositoryPort } from '../../domain/ports/address.repository.port';
import { Address, AddressPatch } from '../../domain/entities/address.entity';
import { AddressNotFoundError } from '../../domain/errors/identity.errors';

export interface UpdateAddressCommand {
  readonly userId: string;
  readonly addressId: string;
  readonly patch: AddressPatch;
  // Only `true` is accepted at the API: the default can be moved to another address, not unset.
  readonly makeDefault: boolean;
}

@Injectable()
export class UpdateAddressUseCase {
  constructor(@Inject(ADDRESS_REPOSITORY) private readonly addresses: AddressRepositoryPort) {}

  async execute(cmd: UpdateAddressCommand): Promise<Result<Address, AddressNotFoundError>> {
    const updated = await this.addresses.update(cmd.addressId, cmd.userId, cmd.patch, cmd.makeDefault);
    return updated ? Ok(updated) : Err(new AddressNotFoundError(cmd.addressId));
  }
}
