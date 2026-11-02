// Same seven fields the order's shipping address takes (POST /orders/:id/address). countryCode is
// ISO 3166-1 alpha-2; which countries are supported is still open (09-DECISIONS.md D-004).
export interface AddressFields {
  readonly fullName: string;
  readonly line1: string;
  readonly line2: string | null;
  readonly city: string;
  readonly region: string;
  readonly postalCode: string;
  readonly countryCode: string;
}

export interface Address extends AddressFields {
  readonly id: string;
  readonly userId: string;
  readonly isDefault: boolean;
  readonly createdAt: Date;
}

// Optional keys may be absent or undefined; `line2: null` clears the second line.
export type AddressPatch = { [K in keyof AddressFields]?: AddressFields[K] | undefined };
