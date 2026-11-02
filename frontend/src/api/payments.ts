import { api } from "./index";

// Saved cards live in Stripe. The server only returns what is safe to show (brand, last four,
// expiry). Card numbers never pass through our API: the browser sends them straight to Stripe.
export type SavedCard = {
  id: string;
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
};

export async function listCards(): Promise<SavedCard[]> {
  const data = await api.request<{ items: SavedCard[] }>("/payments/methods");
  return data.items;
}

// POST /v1/payments/setup-intent: what Stripe's card form needs to attach a card to this user.
// The publishable key is public by design (it ships to browsers).
export function createSetupIntent() {
  return api.request<{ clientSecret: string; publishableKey: string }>("/payments/setup-intent", {
    method: "POST",
  });
}

export function deleteCard(id: string) {
  return api.request<{ removed: true }>(`/payments/methods/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export type PayResult = {
  orderId: string;
  paymentId: string;
  status: "REQUIRES_PAYMENT" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "REFUNDED" | "PARTIALLY_REFUNDED";
  failureCode: string | null;
  failureMessage: string | null;
};

// One key per press of "Pay". The server remembers the answer for a key, so a network retry of the
// same press is safe, but a retry after a decline must use a fresh key or it would just replay the
// decline.
export function newIdempotencyKey(): string {
  return `app-pay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function payOrder(orderId: string, paymentMethodId: string, idempotencyKey: string) {
  return api.request<PayResult>(`/orders/${encodeURIComponent(orderId)}/pay`, {
    method: "POST",
    body: { paymentMethodId },
    idempotencyKey,
  });
}

export function cardLabel(card: SavedCard): string {
  const brand = card.brand.charAt(0).toUpperCase() + card.brand.slice(1);
  return `${brand} ···· ${card.last4}`;
}

export function cardExpiry(card: SavedCard): string {
  return `Expires ${String(card.expiryMonth).padStart(2, "0")}/${String(card.expiryYear).slice(-2)}`;
}
