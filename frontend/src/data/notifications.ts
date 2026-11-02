import type { Activity } from "../types";
import { formatUSD } from "../constants/currency";
export const activity: Activity[] = [
  {
    id: "a1",
    title: "You've been outbid",
    detail: `Air Jordan 4 Retro · Current bid ${formatUSD(1650)}`,
    kind: "bid",
  },
  {
    id: "a2",
    title: "SneakerVault is live",
    detail: "Heat all night · Join the community",
    kind: "live",
  },
  {
    id: "a3",
    title: "Your order has shipped",
    detail: "Nike Dunk Low Retro · Arriving soon",
    kind: "order",
  },
  {
    id: "a4",
    title: "You won the auction!",
    detail: "Studio wireless headphones",
    kind: "win",
  },
  {
    id: "a5",
    title: "Offer accepted",
    detail: "Vintage varsity jacket · Review your order",
    kind: "bid",
  },
  {
    id: "a6",
    title: "Payment complete",
    detail: "Your receipt is ready",
    kind: "payment",
  },
];
