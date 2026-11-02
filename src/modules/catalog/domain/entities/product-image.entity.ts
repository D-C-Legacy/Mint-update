export interface ProductImage {
  readonly id: string;
  readonly productId: string;
  readonly storageKey: string;
  readonly position: number;
  readonly width: number | null;
  readonly height: number | null;
}
