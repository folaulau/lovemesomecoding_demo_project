import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import type {
  AdminUser,
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
} from './models';

/**
 * Admin endpoints, in one typed place.
 *
 * <p>The backend restricts `/api/admin/**` to an ADMIN token. The route guard in the UI is only a
 * usability guard — anyone can edit client-side JavaScript, so the server is the security boundary.
 */
@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly api = inject(ApiService);

  // ---------------------------------------------------------------- reports
  dashboard = (days: number) =>
    this.api.get<ReportDashboard>(`/api/admin/reports/dashboard?days=${days}`);

  // ---------------------------------------------------------------- products
  listProducts = () => this.api.get<Product[]>('/api/admin/products');
  createProduct = (body: ProductWriteRequest) =>
    this.api.post<Product>('/api/admin/products', body);
  updateProduct = (id: UUID, body: ProductWriteRequest) =>
    this.api.put<Product>(`/api/admin/products/${id}`, body);
  deactivateProduct = (id: UUID) =>
    this.api.patch<void>(`/api/admin/products/${id}/deactivate`);
  deleteProduct = (id: UUID) => this.api.delete<void>(`/api/admin/products/${id}`);

  // ---------------------------------------------------------------- toppings
  listToppings = () => this.api.get<Topping[]>('/api/admin/toppings');
  createTopping = (body: ToppingWriteRequest) =>
    this.api.post<Topping>('/api/admin/toppings', body);
  updateTopping = (id: UUID, body: ToppingWriteRequest) =>
    this.api.put<Topping>(`/api/admin/toppings/${id}`, body);
  deactivateTopping = (id: UUID) =>
    this.api.patch<void>(`/api/admin/toppings/${id}/deactivate`);
  deleteTopping = (id: UUID) => this.api.delete<void>(`/api/admin/toppings/${id}`);

  // ---------------------------------------------------------------- crusts
  listCrusts = () => this.api.get<Crust[]>('/api/admin/crusts');
  createCrust = (body: CrustWriteRequest) => this.api.post<Crust>('/api/admin/crusts', body);
  updateCrust = (id: UUID, body: CrustWriteRequest) =>
    this.api.put<Crust>(`/api/admin/crusts/${id}`, body);
  deactivateCrust = (id: UUID) => this.api.patch<void>(`/api/admin/crusts/${id}/deactivate`);
  deleteCrust = (id: UUID) => this.api.delete<void>(`/api/admin/crusts/${id}`);

  // ---------------------------------------------------------------- users
  listUsers = () => this.api.get<AdminUser[]>('/api/admin/users');
  changeUserRole = (id: UUID, role: 'CUSTOMER' | 'ADMIN') =>
    this.api.patch<AdminUser>(`/api/admin/users/${id}/role`, { role });
  deleteUser = (id: UUID) => this.api.delete<void>(`/api/admin/users/${id}`);

  // ---------------------------------------------------------------- orders
  listOrders = (page = 0, size = 20) =>
    this.api.get<Page<Order>>(`/api/admin/orders?page=${page}&size=${size}`);
  updateOrderStatus = (id: UUID, status: OrderStatus) =>
    this.api.patch<Order>(`/api/admin/orders/${id}/status`, { status });
}
