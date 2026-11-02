import { PublicProductItem } from '../../application/queries/list-public-products.query';

// Public shape for /v1/catalog/products. Hidden: `reserved` (internal stock hold), `updatedAt`,
// `status` (always ACTIVE here). `available` is quantity minus reserved: what a buyer can take.
// Images are CDN URLs, never raw storage keys.
export interface PublicProductView {
  readonly id: string;
  readonly sellerId: string;
  readonly categoryId: string;
  readonly title: string;
  readonly description: string | null;
  readonly condition: string;
  readonly quantity: number;
  readonly available: number;
  readonly weightGrams: number | null;
  readonly images: { id: string; url: string; position: number; width: number | null; height: number | null }[];
  readonly createdAt: string;
}

export function toPublicProductView(
  item: PublicProductItem,
  imageUrlFor: (storageKey: string) => string,
): PublicProductView {
  const { product, images } = item;
  return {
    id: product.id,
    sellerId: product.sellerId,
    categoryId: product.categoryId,
    title: product.title,
    description: product.description,
    condition: product.condition,
    quantity: product.quantity,
    available: product.quantity - product.reserved,
    weightGrams: product.weightGrams,
    images: images.map((image) => ({
      id: image.id,
      url: imageUrlFor(image.storageKey),
      position: image.position,
      width: image.width,
      height: image.height,
    })),
    createdAt: product.createdAt.toISOString(),
  };
}
