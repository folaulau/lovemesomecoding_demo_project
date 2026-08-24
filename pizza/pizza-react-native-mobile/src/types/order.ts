import type { UUID } from './common';
import type { SizeName } from './catalog';
import type { OrderType } from './cart';

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PREPARING'
  | 'COMPLETED'
  | 'CANCELLED';

export interface OrderItemTopping {
  id: UUID;
  toppingId: UUID | null;
  toppingName: string;
  price: number;
}

export interface OrderItem {
  id: UUID;
  productId: UUID | null;
  productName: string;
  size: SizeName;
  crustId: UUID | null;
  crustName: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  toppings: OrderItemTopping[];
}

export interface Order {
  id: UUID;
  status: OrderStatus;
  orderType: OrderType;
  customerName: string;
  email: string;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  subtotal: number;
  tax: number;
  deliveryFee: number;
  total: number;
  /** Which card paid, for display only. Null until the payment succeeds. */
  cardBrand: string | null;
  cardLast4: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

/** POST /api/orders — identifiers only. The server prices everything. */
export interface OrderCreateRequest {
  orderType: OrderType;
  customerName: string;
  guestEmail?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  items: {
    productId: UUID;
    size: SizeName;
    crustId: UUID | null;
    toppingIds: UUID[];
    quantity: number;
  }[];
}

export interface OrderCreateResponse {
  order: Order;
  /** Null when the server has no Stripe key configured. */
  clientSecret: string | null;
}
