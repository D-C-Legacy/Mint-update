import { Inject, Injectable } from '@nestjs/common';
import { ADDRESS_REPOSITORY, AddressRepositoryPort } from '../../domain/ports/address.repository.port';
import { Address } from '../../domain/entities/address.entity';

export interface ListAddressesCommand {
  readonly userId: string;
}

@Injectable()
export class ListAddressesUseCase {
  constructor(@Inject(ADDRESS_REPOSITORY) private readonly addresses: AddressRepositoryPort) {}

  async execute(cmd: ListAddressesCommand): Promise<Address[]> {
    return this.addresses.listByUser(cmd.userId);
  }
}
