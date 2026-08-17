import { api } from './api';
import type {
  Crust,
  CrustWriteRequest,
  Order,
  OrderStatus,
  Page,
  Product,
  ProductWriteRequest,
  ReportDashboard,
  Topping,
  ToppingWriteRequest,
  UUID,
} from '../types';

/**
 * Admin endpoints, in one typed place.
 *
 * Every call passes `auth: true`. The backend restricts `/api/admin/**` to an ADMIN token — the
 * ProtectedRoute wrapper in the UI is only a usability guard, never the security boundary.
 */
export const adminApi = {
  // ---------------------------------------------------------------- reports
  dashboard: (days: number) =>
    api.get<ReportDashboard>(`/api/admin/reports/dashboard?days=${days}`, { auth: true }),

  // ---------------------------------------------------------------- products
  listProducts: () => api.get<Product[]>('/api/admin/products', { auth: true }),
  createProduct: (body: ProductWriteRequest) =>
    api.post<Product>('/api/admin/products', body, { auth: true }),
  updateProduct: (id: UUID, body: ProductWriteRequest) =>
    api.put<Product>(`/api/admin/products/${id}`, body, { auth: true }),
  deactivateProduct: (id: UUID) =>
    api.patch<void>(`/api/admin/products/${id}/deactivate`, undefined, { auth: true }),
  deleteProduct: (id: UUID) => api.delete<void>(`/api/admin/products/${id}`, { auth: true }),

  // ---------------------------------------------------------------- toppings
  listToppings: () => api.get<Topping[]>('/api/admin/toppings', { auth: true }),
  createTopping: (body: ToppingWriteRequest) =>
    api.post<Topping>('/api/admin/toppings', body, { auth: true }),
  updateTopping: (id: UUID, body: ToppingWriteRequest) =>
    api.put<Topping>(`/api/admin/toppings/${id}`, body, { auth: true }),
  deactivateTopping: (id: UUID) =>
    api.patch<void>(`/api/admin/toppings/${id}/deactivate`, undefined, { auth: true }),
  deleteTopping: (id: UUID) => api.delete<void>(`/api/admin/toppings/${id}`, { auth: true }),

  // ---------------------------------------------------------------- crusts
  listCrusts: () => api.get<Crust[]>('/api/admin/crusts', { auth: true }),
  createCrust: (body: CrustWriteRequest) =>
    api.post<Crust>('/api/admin/crusts', body, { auth: true }),
  updateCrust: (id: UUID, body: CrustWriteRequest) =>
    api.put<Crust>(`/api/admin/crusts/${id}`, body, { auth: true }),
  deactivateCrust: (id: UUID) =>
    api.patch<void>(`/api/admin/crusts/${id}/deactivate`, undefined, { auth: true }),
  deleteCrust: (id: UUID) => api.delete<void>(`/api/admin/crusts/${id}`, { auth: true }),

  // ---------------------------------------------------------------- orders
  listOrders: (page = 0, size = 20) =>
    api.get<Page<Order>>(`/api/admin/orders?page=${page}&size=${size}`, { auth: true }),
  updateOrderStatus: (id: UUID, status: OrderStatus) =>
    api.patch<Order>(`/api/admin/orders/${id}/status`, { status }, { auth: true }),
};
