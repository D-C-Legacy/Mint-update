import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { ADDRESS_REPOSITORY, AddressRepositoryPort } from '../../domain/ports/address.repository.port';
import { AddressNotFoundError } from '../../domain/errors/identity.errors';

export interface RemoveAddressCommand {
  readonly userId: string;
  readonly addressId: string;
}

// Removing a saved address never touches orders: each order stores its own copy of the address.
@Injectable()
export class RemoveAddressUseCase {
  constructor(@Inject(ADDRESS_REPOSITORY) private readonly addresses: AddressRepositoryPort) {}

  async execute(cmd: RemoveAddressCommand): Promise<Result<{ removed: true }, AddressNotFoundError>> {
    const removed = await this.addresses.remove(cmd.addressId, cmd.userId);
    return removed ? Ok({ removed: true }) : Err(new AddressNotFoundError(cmd.addressId));
  }
}
