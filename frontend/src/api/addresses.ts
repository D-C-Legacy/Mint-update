import { api } from "./index";

// The seven fields the order's shipping address takes (POST /v1/orders/:id/address). The saved
// address book (GET/POST/PATCH/DELETE /v1/me/addresses) is not in 05-API-SPEC.md: added on the
// user's instruction. `countryCode` is ISO alpha-2; the app only offers "US" until the supported
// countries are decided (09-DECISIONS.md D-004).
export type AddressFields = {
  fullName: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
};

export type SavedAddress = AddressFields & { id: string; isDefault: boolean };

export async function listAddresses(): Promise<SavedAddress[]> {
  const data = await api.request<{ items: SavedAddress[] }>("/me/addresses");
  return data.items;
}

export function createAddress(input: AddressFields & { isDefault?: boolean }) {
  return api.request<SavedAddress>("/me/addresses", { method: "POST", body: withoutNullLine2(input) });
}

// A patch: send only what changed. `line2: null` clears the second line; `isDefault` can only be true.
export function updateAddress(id: string, patch: Partial<AddressFields> & { isDefault?: true }) {
  return api.request<SavedAddress>(`/me/addresses/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: patch,
  });
}

export function deleteAddress(id: string) {
  return api.request<{ removed: true }>(`/me/addresses/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// The create and order endpoints take an absent line2, not null.
export function withoutNullLine2<T extends { line2: string | null }>(fields: T): Omit<T, "line2"> & { line2?: string } {
  const { line2, ...rest } = fields;
  return line2 ? { ...rest, line2 } : rest;
}
