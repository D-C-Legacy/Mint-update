import type { SavedAddress } from '../api/addresses';

// Shared by OrderCheckout.tsx and AccountScreen.tsx — moved here (28 Oct 2026) when the standalone
// AddressesScreen it used to live in was folded into the single-page Account redesign.
export function formatAddress(a: SavedAddress) {
  return `${a.line1}${a.line2 ? `, ${a.line2}` : ''}\n${a.city}, ${a.region} ${a.postalCode}`;
}
