import { api } from "./index";
import { stockImageFor } from "../utils/stock-image";

// Public catalog and sales shapes (05-API-SPEC.md §4 and §7). Money is integer minor units.
export type Category = {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  position: number;
  isActive: boolean;
};

export type ProductCondition = "NEW" | "LIKE_NEW" | "USED" | "FOR_PARTS";

export type ProductImage = {
  id: string;
  url: string;
  position: number;
  width: number | null;
  height: number | null;
};

export type PublicProduct = {
  id: string;
  sellerId: string;
  categoryId: string;
  title: string;
  description: string | null;
  condition: ProductCondition;
  quantity: number;
  available: number;
  weightGrams: number | null;
  images: ProductImage[];
  createdAt: string;
};

export type SaleMode = "AUCTION" | "BUY_NOW" | "OFFER";

export type PublicSale = {
  id: string;
  sessionId: string;
  sellerId: string;
  productId: string;
  mode: SaleMode;
  status: string;
  currency: string;
  startAmount: number | null;
  currentAmount: number | null;
  price: number | null;
  quantity: number;
  endsAt: string | null;
  createdAt: string;
};

export type Page<T> = { items: T[]; nextCursor: string | null };

// What a product card needs. `price` comes from the product's open sale, never from the product.
export type CardProduct = {
  id: string;
  title: string;
  image: string; // a real photo, or a seeded stock placeholder when the product has none yet
  price: number | null; // dollars, or null when the product has no open sale
  detail: string;
};

export const CONDITION_LABELS: Record<ProductCondition, string> = {
  NEW: "New",
  LIKE_NEW: "Like new",
  USED: "Used",
  FOR_PARTS: "For parts",
};

export function listCategories(): Promise<Category[]> {
  return api.request<Category[]>("/categories", { auth: false });
}

export function listProducts(filter: {
  categoryId?: string;
  sellerId?: string;
  q?: string;
  cursor?: string;
  limit?: number;
} = {}): Promise<Page<PublicProduct>> {
  return api.request<Page<PublicProduct>>("/catalog/products", { query: { ...filter }, auth: false });
}

export function getProduct(id: string): Promise<PublicProduct> {
  return api.request<PublicProduct>(`/catalog/products/${encodeURIComponent(id)}`, { auth: false });
}

export function listOpenSales(filter: {
  productId?: string;
  mode?: SaleMode;
  limit?: number;
} = {}): Promise<Page<PublicSale>> {
  return api.request<Page<PublicSale>>("/sales", { query: { ...filter }, auth: false });
}

// Minor units to dollars (USD). Every currency here is USD for now.
export function saleAmount(sale: PublicSale): number | null {
  if (sale.mode === "AUCTION") {
    const amount = sale.currentAmount ?? sale.startAmount;
    return amount === null ? null : amount / 100;
  }
  if (sale.mode === "BUY_NOW") {
    return sale.price === null ? null : sale.price / 100;
  }
  return null;
}

// One page of open sales, keyed by product. Covers the first 100 open sales; paging comes later.
async function priceIndex(): Promise<Map<string, PublicSale>> {
  const page = await listOpenSales({ limit: 100 });
  return new Map(page.items.map((sale) => [sale.productId, sale]));
}

function toCard(product: PublicProduct, sale: PublicSale | undefined): CardProduct {
  return {
    id: product.id,
    title: product.title,
    image: product.images[0]?.url ?? stockImageFor(product.id),
    price: sale ? saleAmount(sale) : null,
    detail: CONDITION_LABELS[product.condition],
  };
}

export async function toCards(products: PublicProduct[]): Promise<CardProduct[]> {
  const prices = await priceIndex();
  return products.map((product) => toCard(product, prices.get(product.id)));
}

// Popular auctions: open auction sales, with their products. A sale whose product is no longer
// public is skipped rather than failing the whole list.
export async function loadAuctionCards(): Promise<CardProduct[]> {
  const sales = await listOpenSales({ mode: "AUCTION", limit: 10 });
  const results = await Promise.allSettled(sales.items.map((sale) => getProduct(sale.productId)));
  const cards: CardProduct[] = [];
  results.forEach((result, index) => {
    const sale = sales.items[index];
    if (result.status === "fulfilled" && sale) cards.push(toCard(result.value, sale));
  });
  return cards;
}

// Products under a top-level category (all of its children), or the latest products when null.
export async function loadCardsForCategory(
  categoryId: string | null,
  categories: Category[],
): Promise<CardProduct[]> {
  let products: PublicProduct[];
  if (categoryId === null) {
    products = (await listProducts({ limit: 40 })).items;
  } else {
    const children = categories.filter((c) => c.parentId === categoryId).map((c) => c.id);
    const targets = children.length > 0 ? children : [categoryId];
    const pages = await Promise.all(targets.map((id) => listProducts({ categoryId: id, limit: 40 })));
    const seen = new Set<string>();
    products = [];
    for (const page of pages) {
      for (const product of page.items) {
        if (!seen.has(product.id)) {
          seen.add(product.id);
          products.push(product);
        }
      }
    }
    products.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  return toCards(products);
}
