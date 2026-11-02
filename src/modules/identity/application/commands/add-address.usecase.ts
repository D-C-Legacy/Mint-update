import { Inject, Injectable } from '@nestjs/common';
import { generateId } from '../../../../shared/ids/id';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { ADDRESS_REPOSITORY, AddressRepositoryPort } from '../../domain/ports/address.repository.port';
import { Address, AddressFields } from '../../domain/entities/address.entity';
import { AddressLimitReachedError } from '../../domain/errors/identity.errors';
import {
  MAX_ADDRESSES_PER_USER,
  hasRoomForAnotherAddress,
  shouldBecomeDefault,
} from '../../domain/rules/address-book.rule';

export interface AddAddressCommand {
  readonly userId: string;
  readonly fields: AddressFields;
  readonly makeDefault: boolean;
}

@Injectable()
export class AddAddressUseCase {
  constructor(@Inject(ADDRESS_REPOSITORY) private readonly addresses: AddressRepositoryPort) {}

  async execute(cmd: AddAddressCommand): Promise<Result<Address, AddressLimitReachedError>> {
    const count = await this.addresses.countByUser(cmd.userId);
    if (!hasRoomForAnotherAddress(count)) {
      return Err(new AddressLimitReachedError(MAX_ADDRESSES_PER_USER));
    }
    const created = await this.addresses.create({
      id: generateId(),
      userId: cmd.userId,
      ...cmd.fields,
      isDefault: shouldBecomeDefault(count, cmd.makeDefault),
    });
    return Ok(created);
  }
}
