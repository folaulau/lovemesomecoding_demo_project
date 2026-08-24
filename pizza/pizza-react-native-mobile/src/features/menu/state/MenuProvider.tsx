import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { catalogApi, toUserMessage } from '@/api';
import type { Crust, Product, Topping } from '@/types';

/* ==========================================================================
 * The catalogue, fetched once.
 *
 * The menu, toppings and crusts are needed by the menu screen, the builder sheet and the cart's
 * rehydration. They change rarely and are identical for every customer, so fetching them once here
 * beats each screen fetching for itself — three screens mounting would otherwise mean three
 * identical round trips over a mobile connection.
 *
 * This is where a data library like TanStack Query would normally go. Doing it by hand once is
 * worth seeing first: the loading flag, the error branch and the cancellation below are exactly
 * what such a library gives you for free.
 * ========================================================================== */

interface MenuContextValue {
  products: Product[];
  pizzas: Product[];
  drinks: Product[];
  toppings: Topping[];
  crusts: Crust[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

const MenuContext = createContext<MenuContextValue | undefined>(undefined);

export function MenuProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [toppings, setToppings] = useState<Topping[]>([]);
  const [crusts, setCrusts] = useState<Crust[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /*
   * A counter, not a boolean. Incrementing it changes the effect's dependency, which re-runs the
   * fetch — and it works for the SECOND retry too, whereas a boolean flag would have to be reset
   * and would race with the request it triggered.
   */
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        /*
         * Promise.all, not three sequential awaits: the requests are independent, so serialising
         * them would triple the wait. On a phone that is the difference between a menu that opens
         * and a menu that appears to hang.
         */
        const [productData, toppingData, crustData] = await Promise.all([
          catalogApi.listProducts(controller.signal),
          catalogApi.listToppings(controller.signal),
          catalogApi.listCrusts(controller.signal),
        ]);
        setProducts(productData);
        setToppings(toppingData);
        setCrusts(crustData);
      } catch (err) {
        // An abort is not a failure — it means the provider unmounted or a reload superseded us.
        if (controller.signal.aborted) return;
        setError(toUserMessage(err, 'Could not load the menu.'));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();

    /*
     * Cleanup cancels the in-flight requests. Without it, a slow first response can land AFTER a
     * fast retry and overwrite fresher data — and in development StrictMode runs every effect
     * twice, so the race is not hypothetical.
     */
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
  const context = use(MenuContext);
  if (context === undefined) {
    throw new Error('useMenu must be used inside a <MenuProvider>');
  }
  return context;
}
