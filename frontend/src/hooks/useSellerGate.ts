import { useEffect, useState } from 'react';
import { getMySeller, type Seller } from '../api/seller';

// Shared between the mobile Sell tab and the desktop Seller studio layout: whether the signed-in
// user is an APPROVED seller (`GET /seller/application`). Each platform's layout decides what to
// render for "not approved yet" vs "approved" — this hook only owns the gate check itself.
export function useSellerGate() {
  const [seller, setSeller] = useState<Seller | null | 'loading'>('loading');

  const reload = () => {
    getMySeller()
      .then(setSeller)
      .catch(() => setSeller(null));
  };

  useEffect(reload, []);

  return { seller, reload };
}
