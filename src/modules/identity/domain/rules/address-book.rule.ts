// A safety cap, not a business number from the docs: stops one account from filling the table.
export const MAX_ADDRESSES_PER_USER = 10;

export function hasRoomForAnotherAddress(existingCount: number): boolean {
  return existingCount < MAX_ADDRESSES_PER_USER;
}

// The first address a user saves is always their default; later ones only if asked.
export function shouldBecomeDefault(existingCount: number, requested: boolean): boolean {
  return existingCount === 0 || requested;
}
