declare const brand: unique symbol;

export type Branded<T, B extends string> = T & { readonly [brand]: B };

export type UserId = Branded<string, 'UserId'>;
export type SellerId = Branded<string, 'SellerId'>;
export type AuctionId = Branded<string, 'AuctionId'>;
