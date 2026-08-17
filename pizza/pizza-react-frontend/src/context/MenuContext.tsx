import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import type { Crust, Product, Topping } from '../types';

/* ==========================================================================
 * REACT CONCEPT: Context for server data
 *
 * The menu, toppings and crusts are needed by the menu page, the builder modal and the admin
 * screen. They change rarely and are identical for every visitor, so fetching them once here beats
 * each component fetching for itself — three components mounting would otherwise mean three
 * identical round trips.
 *
 * This is where a data library like TanStack Query would normally go. Doing it by hand once is
 * worth seeing first: the loading flag, the error branch, and the cleanup are exactly what such a
 * library gives you for free.
 * ========================================================================== */

interface MenuContextValue {
  products: Product[];
  pizzas: Product[];
  drinks: Product[];
  toppings: Topping[];
  crusts: Crust[];
  loading: boolean;
  error: string | null;
  /** Re-fetch, e.g. after an admin edits the menu. */
  reload: () => void;
}

const MenuContext = createContext<MenuContextValue | undefined>(undefined);

export function MenuProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [toppings, setToppings] = useState<Topping[]>([]);
  const [crusts, setCrusts] = useState<Crust[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  /*
   * REACT CONCEPT: useEffect for data fetching, done properly.
   *
   * Two details that are easy to get wrong:
   *  1. AbortController + the cleanup function. In React 18+ StrictMode every effect runs twice in
   *     development; without cleanup you get two in-flight requests and the slower one can win,
   *     overwriting fresher state. Aborting on unmount also prevents setting state on a component
   *     that is no longer mounted.
   *  2. Promise.all rather than three sequential awaits — the three requests are independent, so
   *     serialising them would triple the wait for no reason.
   */
  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [productData, toppingData, crustData] = await Promise.all([
          api.get<Product[]>('/api/products', { signal: controller.signal }),
          api.get<Topping[]>('/api/toppings', { signal: controller.signal }),
          api.get<Crust[]>('/api/crusts', { signal: controller.signal }),
        ]);
        setProducts(productData);
        setToppings(toppingData);
        setCrusts(crustData);
      } catch (err) {
        // An abort is not a failure — it means we navigated away or StrictMode re-ran the effect.
        if (controller.signal.aborted) return;
        setError(
          err instanceof Error
            ? `Could not load the menu: ${err.message}`
            : 'Could not load the menu.',
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [reloadToken]);

  // Derived lists, recomputed only when products actually change.
  const pizzas = useMemo(() => products.filter((p) => p.type === 'PIZZA'), [products]);
  const drinks = useMemo(() => products.filter((p) => p.type === 'DRINK'), [products]);

  const value = useMemo<MenuContextValue>(
    () => ({ products, pizzas, drinks, toppings, crusts, loading, error, reload }),
    [products, pizzas, drinks, toppings, crusts, loading, error, reload],
  );

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

export function useMenu(): MenuContextValue {
  const context = useContext(MenuContext);
  if (context === undefined) {
    throw new Error('useMenu must be used inside a <MenuProvider>');
  }
  return context;
}
