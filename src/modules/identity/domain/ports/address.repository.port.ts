import { Address, AddressFields, AddressPatch } from '../entities/address.entity';

export const ADDRESS_REPOSITORY = Symbol('AddressRepositoryPort');

export interface CreateAddressInput extends AddressFields {
  readonly id: string;
  readonly userId: string;
  readonly isDefault: boolean;
}

// Every write that touches the default flag runs in one transaction, so a user never ends up with
// two defaults. Methods that take `userId` only ever see that user's rows (someone else's id is
// the same as a missing one).
export interface AddressRepositoryPort {
  // Default first, then oldest first.
  listByUser(userId: string): Promise<Address[]>;
  countByUser(userId: string): Promise<number>;
  // When input.isDefault is true, clears the flag on the user's other addresses.
  create(input: CreateAddressInput): Promise<Address>;
  // `makeDefault: true` clears the flag on the others. Returns null when not found / not owned.
  update(id: string, userId: string, patch: AddressPatch, makeDefault: boolean): Promise<Address | null>;
  // If the deleted row was the default, the oldest remaining address becomes the default.
  // Returns false when not found / not owned.
  remove(id: string, userId: string): Promise<boolean>;
}
