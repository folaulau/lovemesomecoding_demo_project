/**
 * Shared domain types.
 *
 * These mirror the Spring Boot API's DTOs exactly. Keeping one file as the contract means that if
 * the shapes drift, TypeScript fails the build instead of the UI failing at runtime.
 */

/**
 * Every identifier the API accepts or returns is a UUID string.
 *
 * The backend keeps a numeric primary key internally but never publishes it: sequential ids would
 * let anyone walk /api/orders/1, /2, /3 and read other people's orders. This alias exists so the
 * intent is obvious at every use site — it is a UUID, not "some string".
 */
export type UUID = string;

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

/**
 * One line in the cart.
 *
 * `lineId` is generated in the browser and is NOT sent to the server — the same pizza can appear
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

export interface User {
  id: UUID;
  email: string;
  fullName: string | null;
  role: 'CUSTOMER' | 'ADMIN';
  createdAt: string;
}

export interface AuthenticationResponse {
  token: string;
  expiresInMinutes: number;
  user: User;
}

// ---------------------------------------------------------------- orders

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
  items: Array<{
    productId: UUID;
    size: SizeName;
    crustId: UUID | null;
    toppingIds: UUID[];
    quantity: number;
  }>;
}

export interface OrderCreateResponse {
  order: Order;
  /** Null when the server has no Stripe key configured. */
  clientSecret: string | null;
}

/** Spring's paginated envelope, trimmed to what the UI uses. */
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

// ---------------------------------------------------------------- errors

/** One invalid field, from the API's ApiSubError. */
export interface ApiSubError {
  field: string | null;
  message: string;
}

/** The single error envelope every endpoint returns. */
export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string;
  path: string;
  timestamp: string;
  errors?: ApiSubError[];
}

// ---------------------------------------------------------------- reports

export interface ReportDashboard {
  summary: {
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    itemsSold: number;
  };
  revenueByDay: Array<{ day: string; orders: number; revenue: number }>;
  topProducts: Array<{ productName: string; unitsSold: number; revenue: number }>;
  statusBreakdown: Array<{ status: string; count: number }>;
}

// ---------------------------------------------------------------- admin write payloads

/** POST/PUT /api/admin/products — matches the backend's ProductCreateDTO. */
export interface ProductWriteRequest {
  name: string;
  description: string;
  type: ProductType;
  imageUrl: string | null;
  active: boolean;
  displayOrder: number;
  sizes: Array<{ size: SizeName; price: number }>;
}

export interface ToppingWriteRequest {
  name: string;
  price: number;
  category: ToppingCategory;
  active: boolean;
}

export interface CrustWriteRequest {
  name: string;
  priceDelta: number;
  active: boolean;
  displayOrder: number;
}
