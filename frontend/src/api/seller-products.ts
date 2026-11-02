import { api } from './index';
import type { Page, ProductCondition } from './catalog';

// The seller's own products (`POST`/`GET`/`PATCH`/`DELETE /v1/products`, 05-API-SPEC.md §4) — not
// the public `/catalog/products` the buyer browse screens use. Catalog data only: there is no
// price field on Product at all — price and listing type (auction/buy-now) only exist on a Sale,
// which needs a stream session (blocked on streaming, see prompt.md). Flagged in the Inventory/
// Listing screens rather than invented.
export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'SOLD' | 'ARCHIVED';

// No `images` field: the seller-scoped `/products` routes return the plain `Product` aggregate,
// which doesn't carry images (only the public `/catalog/products/:id` response does, via a
// separate enrichment query) — not invented, matches the real response shape.
export type SellerProduct = {
  id: string;
  sellerId: string;
  categoryId: string;
  title: string;
  description: string | null;
  condition: ProductCondition;
  status: ProductStatus;
  quantity: number;
  reserved: number;
  weightGrams: number | null;
  createdAt: string;
};

export function listMyProducts(
  filter: { status?: ProductStatus; cursor?: string; limit?: number } = {},
): Promise<Page<SellerProduct>> {
  return api.request<Page<SellerProduct>>('/products', { query: { ...filter } });
}

export function getMyProduct(id: string): Promise<SellerProduct> {
  return api.request<SellerProduct>(`/products/${encodeURIComponent(id)}`);
}

// create/update return only a thin result (productId, and status for create), not the full
// product — matches CreateProductUseCase/UpdateProductUseCase's real result shape, not invented.
export function createProduct(input: {
  categoryId: string;
  title: string;
  description?: string;
  condition: ProductCondition;
  quantity: number;
  weightGrams?: number;
}): Promise<{ productId: string; status: ProductStatus }> {
  return api.request<{ productId: string; status: ProductStatus }>('/products', {
    method: 'POST',
    body: input,
  });
}

export function updateProduct(
  id: string,
  input: Partial<{
    categoryId: string;
    title: string;
    description: string;
    condition: ProductCondition;
    quantity: number;
    weightGrams: number;
  }>,
): Promise<{ productId: string }> {
  return api.request<{ productId: string }>(`/products/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: input,
  });
}

// Archives the product (soft delete — status moves to ARCHIVED, the row is not removed). Returns
// only the id/status, not the full product.
export function archiveProduct(id: string): Promise<{ productId: string; status: ProductStatus }> {
  return api.request<{ productId: string; status: ProductStatus }>(
    `/products/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    },
  );
}

// Moves a product DRAFT->ACTIVE. Requires at least one attached image server-side
// (PRODUCT_NOT_PUBLISHABLE, 409) or the product is already public and buyers can find it.
export function publishProduct(id: string): Promise<{ productId: string; status: ProductStatus }> {
  return api.request<{ productId: string; status: ProductStatus }>(
    `/products/${encodeURIComponent(id)}/publish`,
    {
      method: 'POST',
    },
  );
}

// Moves a product ACTIVE->DRAFT, pulling it back out of public view.
export function unpublishProduct(
  id: string,
): Promise<{ productId: string; status: ProductStatus }> {
  return api.request<{ productId: string; status: ProductStatus }>(
    `/products/${encodeURIComponent(id)}/unpublish`,
    {
      method: 'POST',
    },
  );
}

export type ProductImage = {
  id: string;
  url: string;
  position: number;
  width: number | null;
  height: number | null;
};

export type ImageUploadSlot = { uploadUrl: string; storageKey: string; expiresIn: number };

// POST /v1/products/:id/images/upload-url: mints a presigned S3 PUT URL, same two-step flow as
// requestAvatarUpload (identity.ts) — PUT the bytes to `uploadUrl` directly, then pass the
// returned `storageKey` to attachProductImage to actually attach it.
export function requestProductImageUpload(
  productId: string,
  input: { fileName: string; mimeType: string; sizeBytes: number },
): Promise<ImageUploadSlot> {
  return api.request<ImageUploadSlot>(
    `/products/${encodeURIComponent(productId)}/images/upload-url`,
    {
      method: 'POST',
      body: input,
    },
  );
}

export function attachProductImage(
  productId: string,
  input: { storageKey: string; width?: number; height?: number },
): Promise<{ imageId: string }> {
  return api.request<{ imageId: string }>(`/products/${encodeURIComponent(productId)}/images`, {
    method: 'POST',
    body: input,
  });
}

export function listProductImages(productId: string): Promise<{ items: ProductImage[] }> {
  return api.request<{ items: ProductImage[] }>(
    `/products/${encodeURIComponent(productId)}/images`,
  );
}

export function detachProductImage(productId: string, imageId: string): Promise<unknown> {
  return api.request(
    `/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}`,
    {
      method: 'DELETE',
    },
  );
}
