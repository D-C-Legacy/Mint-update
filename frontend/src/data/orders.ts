import type { Order } from "../types";

export const orders: Order[] = [
  { id: "SF-1042", productId: "dunk", status: "Shipped", date: "Sep 30" },
  {
    id: "SF-1039",
    productId: "headphones",
    status: "Delivered",
    date: "Sep 26",
  },
  {
    id: "SF-1044",
    productId: "jordan",
    status: "Awaiting Payment",
    date: "Today",
  },
  { id: "SF-1032", productId: "jacket", status: "Cancelled", date: "Sep 20" },
];
