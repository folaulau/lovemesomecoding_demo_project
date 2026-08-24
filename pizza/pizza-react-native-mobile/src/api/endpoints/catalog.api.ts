import { apiClient } from '../client';
import type { Crust, Product, Topping } from '@/types';

/**
 * The public menu. No token: browsing does not require an account.
 *
 * <p>Grouping the calls behind a named object rather than exporting loose functions means a screen
 * imports `catalogApi` and gets autocomplete for everything the menu can do — and it keeps the URL
 * strings in one file, where a backend rename is a one-line change.
 */
export const catalogApi = {
  listProducts: (signal?: AbortSignal) => apiClient.get<Product[]>('/api/products', { signal }),
  listToppings: (signal?: AbortSignal) => apiClient.get<Topping[]>('/api/toppings', { signal }),
  listCrusts: (signal?: AbortSignal) => apiClient.get<Crust[]>('/api/crusts', { signal }),
};
