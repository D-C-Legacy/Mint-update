export interface Category {
  readonly id: string;
  readonly parentId: string | null;
  readonly slug: string;
  readonly name: string;
  readonly position: number;
  readonly isActive: boolean;
}
