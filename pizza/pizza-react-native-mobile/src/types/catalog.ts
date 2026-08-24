import type { UUID } from './common';

export type ProductType = 'PIZZA' | 'DRINK';
export type SizeName = 'SMALL' | 'MEDIUM' | 'LARGE';
export type ToppingCategory = 'MEAT' | 'VEGGIE' | 'CHEESE';

export interface ProductSize {
  id: UUID;
  size: SizeName;
  price: number;
}

export interface Product {
  id: UUID;
  name: string;
  description: string;
  type: ProductType;
  imageUrl: string | null;
  active: boolean;
  displayOrder: number;
  sizes: ProductSize[];
  createdAt: string;
  updatedAt: string;
}

export interface Topping {
  id: UUID;
  name: string;
  price: number;
  category: ToppingCategory;
  active: boolean;
}

export interface Crust {
  id: UUID;
  name: string;
  priceDelta: number;
  active: boolean;
  displayOrder: number;
}
