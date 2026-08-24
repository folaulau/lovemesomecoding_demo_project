import type { UUID } from './common';
import type { ProductType, SizeName, Topping } from './catalog';

export type OrderType = 'DELIVERY' | 'CARRYOUT';

/**
 * One line in the cart, as the APP holds it.
 *
 * <p>`lineId` is generated on the device and is NOT sent to the server — the same pizza can appear
 * twice with different toppings, so the product id alone cannot identify a cart line.
 */
export interface CartItem {
  lineId: string;
  productId: UUID;
  productName: string;
  productType: ProductType;
  imageUrl: string | null;
  size: SizeName;
  basePrice: number;
  crustId: UUID | null;
  crustName: string | null;
  crustPriceDelta: number;
  toppings: Topping[];
  quantity: number;
}

/** One line as the SERVER stores it — identifiers, plus prices resolved at read time. */
export interface ServerCartItem {
  id: UUID;
  productId: UUID;
  productName: string;
  productType: ProductType;
  size: SizeName;
  crustId: UUID | null;
  crustName: string | null;
  quantity: number;
  toppings: { toppingId: UUID; toppingName: string; price: number }[];
  unitPrice: number;
  lineTotal: number;
}

/**
 * A cart as persisted by the API.
 *
 * <p>The stored cart holds identifiers only; the money below is recomputed from the current menu
 * on every read, by the same rules the checkout uses.
 */
export interface ServerCart {
  id: UUID;
  orderType: OrderType;
  items: ServerCartItem[];
  subtotal: number;
  tax: number;
  deliveryFee: number;
  total: number;
  itemCount: number;
}

/** PUT /api/carts/{id} — the whole cart, replaced in one idempotent write. */
export interface CartWriteRequest {
  orderType: OrderType;
  items: {
    productId: UUID;
    size: SizeName;
    crustId: UUID | null;
    toppingIds: UUID[];
    quantity: number;
  }[];
}
