export type Order = {
  amount?: number;
  shipping?: number;
  id: string;
  productId: string;
  status:
    "Awaiting Payment" | "Processing" | "Shipped" | "Delivered" | "Cancelled";
  date: string;
};
