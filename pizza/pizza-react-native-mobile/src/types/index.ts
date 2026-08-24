/**
 * The shared API contract.
 *
 * <p>These mirror the Spring Boot API's DTOs exactly, and they are deliberately the same shapes as
 * `pizza-react-frontend/src/types/index.ts`. Keeping one file per domain (rather than one 340-line
 * file) means a change to orders does not show up in the diff of a menu change.
 *
 * <p>Admin types are absent on purpose: this app is customer-facing, and importing a type the app
 * cannot use would only invite someone to build the screen.
 */
export type { UUID, Page, ApiSubError, ApiErrorBody } from './common';
export type {
  ProductType,
  SizeName,
  ToppingCategory,
  ProductSize,
  Product,
  Topping,
  Crust,
} from './catalog';
export type { OrderType, CartItem, ServerCartItem, ServerCart, CartWriteRequest } from './cart';
export type {
  OrderStatus,
  OrderItemTopping,
  OrderItem,
  Order,
  OrderCreateRequest,
  OrderCreateResponse,
} from './order';
export type {
  UserRole,
  User,
  AuthenticationResponse,
  Address,
  AddressWriteRequest,
  PaymentMethod,
} from './user';
