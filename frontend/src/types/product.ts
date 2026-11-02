export type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
  condition: string;
  variant: string;
  image: string;
  sellerId: string;
  status: "Active" | "Draft" | "Sold" | "Archived";
  quantity: number;
  listingType?: "Buy Now" | "Auction";
  description?: string;
  shipping?: number;
  startingPrice?: number;
};
