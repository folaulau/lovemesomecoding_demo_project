/**
 * Shared domain types.
 *
 * These mirror the Spring Boot API's DTOs exactly. Keeping one file as the contract means that
 * when Phase 4 swaps mock data for real fetch calls, nothing else has to change — if the shapes
 * drift, TypeScript fails the build instead of the UI failing at runtime.
 */

export type ProductType = 'PIZZA' | 'DRINK';
export type SizeName = 'SMALL' | 'MEDIUM' | 'LARGE';
export type ToppingCategory = 'MEAT' | 'VEGGIE' | 'CHEESE';
export type OrderType = 'DELIVERY' | 'CARRYOUT';

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PREPARING'
  | 'COMPLETED'
  | 'CANCELLED';

export interface ProductSize {
  size: SizeName;
  price: number;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  type: ProductType;
  imageUrl: string | null;
  sizes: ProductSize[];
}

export interface Topping {
  id: number;
  name: string;
  price: number;
  category: ToppingCategory;
}

export interface Crust {
  id: number;
  name: string;
  priceDelta: number;
}

/**
 * One line in the cart.
 *
 * `lineId` exists because the same pizza can appear twice with different toppings — the product
 * id alone cannot identify a line. It is generated when the item is added.
 */
export interface CartItem {
  lineId: string;
  productId: number;
  productName: string;
  productType: ProductType;
  imageUrl: string | null;
  size: SizeName;
  basePrice: number;
  crustId: number | null;
  crustName: string | null;
  crustPriceDelta: number;
  toppings: Topping[];
  quantity: number;
}

export interface User {
  id: number;
  email: string;
  fullName: string | null;
  role: 'CUSTOMER' | 'ADMIN';
}
