import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  CartItem,
  CartWriteRequest,
  Crust,
  OrderType,
  Product,
  ServerCart,
  SizeName,
  Topping,
} from '../types';
import { calculateTotals, type CartTotals } from '../lib/money';
import { api, cartIdStore } from '../lib/api';
import { useMenu } from './MenuContext';

/* ==========================================================================
 * REACT CONCEPT: Context + useReducer, with server persistence
 *
 * The cart is needed by the navbar badge, the menu page, the cart drawer and checkout. Threading
 * it through props would mean passing it through every component in between ("prop drilling").
 * Context lets any descendant read it directly.
 *
 * useReducer rather than useState because cart updates are a small set of well-defined operations,
 * several of which depend on the previous state (incrementing a quantity, merging a duplicate
 * line). A reducer keeps that logic in one testable function instead of scattering it across event
 * handlers.
 *
 * PERSISTENCE. The cart is saved to the backend, so refreshing the page — or opening a second tab
 * — does not lose the basket. Two effects do it:
 *
 *   1. HYDRATE on mount: if the browser remembers a cart UUID, fetch that cart and load it.
 *   2. PERSIST on change: debounced PUT of the whole cart.
 *
 * Only the UUID lives in localStorage; the contents live in the database. The server stores
 * identifiers only and re-prices on every read, so a cart left overnight picks up today's menu
 * rather than quietly honouring yesterday's.
 * ========================================================================== */

interface CartState {
  items: CartItem[];
  orderType: OrderType;
}

/**
 * Every way the cart can change, as a discriminated union.
 *
 * TypeScript narrows `action.payload` based on `action.type`, so the reducer's switch is
 * exhaustively type-checked: add a new action and forget to handle it, and the build fails.
 */
type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: { lineId: string } }
  | { type: 'SET_QUANTITY'; payload: { lineId: string; quantity: number } }
  | { type: 'SET_ORDER_TYPE'; payload: { orderType: OrderType } }
  | { type: 'HYDRATE'; payload: CartState }
  | { type: 'CLEAR' };

const initialState: CartState = {
  items: [],
  orderType: 'DELIVERY',
};

/**
 * Two cart lines are "the same" only if the product, size, crust AND topping set all match.
 * Without this, adding a plain pepperoni and a pepperoni with extra cheese would collapse into
 * one line and the customer would be charged for the wrong pizza.
 */
function isSameConfiguration(a: CartItem, b: CartItem): boolean {
  if (a.productId !== b.productId || a.size !== b.size || a.crustId !== b.crustId) {
    return false;
  }
  if (a.toppings.length !== b.toppings.length) {
    return false;
  }
  const aIds = a.toppings.map((t) => t.id).sort();
  const bIds = b.toppings.map((t) => t.id).sort();
  return aIds.every((id, index) => id === bIds[index]);
}

/**
 * The reducer is a pure function: same state + same action always produces the same result, and
 * it never mutates its arguments. That is why every branch builds a NEW array with map/filter
 * rather than calling push or assigning to items[i] — React compares by reference to decide
 * whether to re-render, so mutating in place would update the data without updating the screen.
 */
export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.find((item) => isSameConfiguration(item, action.payload));

      if (existing) {
        // Same configuration already in the cart: bump the quantity instead of adding a line.
        return {
          ...state,
          items: state.items.map((item) =>
            item.lineId === existing.lineId
              ? { ...item, quantity: item.quantity + action.payload.quantity }
              : item,
          ),
        };
      }

      return { ...state, items: [...state.items, action.payload] };
    }

    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter((item) => item.lineId !== action.payload.lineId),
      };

    case 'SET_QUANTITY': {
      // Dropping to zero removes the line — it is what a user expects from a "−" button.
      if (action.payload.quantity <= 0) {
        return {
          ...state,
          items: state.items.filter((item) => item.lineId !== action.payload.lineId),
        };
      }
      return {
        ...state,
        items: state.items.map((item) =>
          item.lineId === action.payload.lineId
            ? { ...item, quantity: action.payload.quantity }
            : item,
        ),
      };
    }

    case 'SET_ORDER_TYPE':
      return { ...state, orderType: action.payload.orderType };

    /** Replace everything with what the server had saved. */
    case 'HYDRATE':
      return action.payload;

    case 'CLEAR':
      return { ...state, items: [] };

    default:
      return state;
  }
}

interface CartContextValue {
  items: CartItem[];
  orderType: OrderType;
  totals: CartTotals;
  addItem: (input: AddItemInput) => void;
  removeItem: (lineId: string) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  setOrderType: (orderType: OrderType) => void;
  clear: () => void;
  /** False until the saved cart has been fetched — the badge should not flash "empty" first. */
  hydrated: boolean;
}

export interface AddItemInput {
  product: Product;
  size: SizeName;
  crust: Crust | null;
  toppings: Topping[];
  quantity: number;
}

/**
 * `undefined` as the default is deliberate: it lets the useCart hook below detect a component
 * rendered outside the provider and throw a clear error, instead of silently handing back an
 * empty cart that never updates.
 */
const CartContext = createContext<CartContextValue | undefined>(undefined);

/** Turn the browser's cart lines into the identifiers-only shape the API accepts. */
function toWriteRequest(state: CartState): CartWriteRequest {
  return {
    orderType: state.orderType,
    items: state.items.map((item) => ({
      productId: item.productId,
      size: item.size,
      crustId: item.crustId,
      toppingIds: item.toppings.map((t) => t.id),
      quantity: item.quantity,
    })),
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);
  const [hydrated, setHydrated] = useState(false);

  // The catalogue is needed to rebuild a saved line's base price and crust surcharge.
  const { products, crusts, loading: menuLoading } = useMenu();

  /*
   * A ref, not state: the persist effect needs the CURRENT cart id without re-running every time
   * the id changes (which would cause an extra PUT).
   */
  const cartIdRef = useRef<string | null>(cartIdStore.get());

  /* -------------------------------------------------------------- 1. hydrate */
  useEffect(() => {
    // Wait for the menu: a saved line stores only ids, so prices come from the catalogue.
    if (menuLoading) return;

    const cartId = cartIdRef.current;
    if (!cartId) {
      setHydrated(true);
      return;
    }

    let cancelled = false;

    api
      .get<ServerCart>(`/api/carts/${cartId}`)
      .then((cart) => {
        if (cancelled) return;

        const items: CartItem[] = cart.items.map((line) => {
          const product = products.find((p) => p.id === line.productId);
          const crust = crusts.find((c) => c.id === line.crustId);

          return {
            // A fresh browser-only key; the server's line id is not reused because a line's
            // identity here is "this configuration", not a database row.
            lineId: crypto.randomUUID(),
            productId: line.productId,
            productName: line.productName,
            productType: line.productType,
            imageUrl: product?.imageUrl ?? null,
            size: line.size,
            basePrice: product?.sizes.find((s) => s.size === line.size)?.price ?? 0,
            crustId: line.crustId,
            crustName: line.crustName,
            crustPriceDelta: crust?.priceDelta ?? 0,
            toppings: line.toppings.map((t) => ({
              id: t.toppingId,
              name: t.toppingName,
              price: t.price,
              // Not stored on a cart line; only the id, name and price are needed to re-price.
              category: 'MEAT',
              active: true,
            })),
            quantity: line.quantity,
          };
        });

        dispatch({ type: 'HYDRATE', payload: { items, orderType: cart.orderType } });
      })
      .catch(() => {
        // The saved cart is gone (deleted, or a stale id from another environment). Forget it
        // rather than leaving the browser pointing at a cart that will never load.
        if (!cancelled) {
          cartIdStore.clear();
          cartIdRef.current = null;
        }
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });

    return () => {
      cancelled = true;
    };
  }, [menuLoading, products, crusts]);

  /* -------------------------------------------------------------- 2. persist */
  useEffect(() => {
    // Never write before hydrating — that would overwrite the saved cart with an empty one.
    if (!hydrated) return;

    // Debounced: clicking "+" three times quickly is one write, not three.
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          let cartId = cartIdRef.current;

          if (!cartId) {
            // Do not create a cart row just because someone loaded the home page.
            if (state.items.length === 0) return;
            const created = await api.post<ServerCart>('/api/carts');
            cartId = created.id;
            cartIdRef.current = cartId;
            cartIdStore.set(cartId);
          }

          await api.put<ServerCart>(`/api/carts/${cartId}`, toWriteRequest(state));
        } catch {
          // A failed save must not break the page. The cart still works in this tab; it just
          // will not survive a refresh. Surfacing a toast on every keystroke would be worse.
        }
      })();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [state, hydrated]);

  /*
   * REACT CONCEPT: useCallback
   * These functions are handed to consumers through context. Without useCallback a new function
   * identity would be created on every render, which would change the context value every time
   * and defeat the React.memo on the components below it.
   */
  const addItem = useCallback((input: AddItemInput) => {
    const basePrice = input.product.sizes.find((s) => s.size === input.size)?.price ?? 0;

    dispatch({
      type: 'ADD_ITEM',
      payload: {
        // crypto.randomUUID is built into modern browsers — no library needed.
        lineId: crypto.randomUUID(),
        productId: input.product.id,
        productName: input.product.name,
        productType: input.product.type,
        imageUrl: input.product.imageUrl,
        size: input.size,
        basePrice,
        crustId: input.crust?.id ?? null,
        crustName: input.crust?.name ?? null,
        crustPriceDelta: input.crust?.priceDelta ?? 0,
        toppings: input.toppings,
        quantity: input.quantity,
      },
    });
  }, []);

  const removeItem = useCallback((lineId: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: { lineId } });
  }, []);

  const setQuantity = useCallback((lineId: string, quantity: number) => {
    dispatch({ type: 'SET_QUANTITY', payload: { lineId, quantity } });
  }, []);

  const setOrderType = useCallback((orderType: OrderType) => {
    dispatch({ type: 'SET_ORDER_TYPE', payload: { orderType } });
  }, []);

  const clear = useCallback(() => {
    dispatch({ type: 'CLEAR' });
  }, []);

  /*
   * REACT CONCEPT: useMemo
   * Totals are derived from the items, so they are recomputed rather than stored — one source of
   * truth. Wrapping the whole context value in useMemo means consumers only re-render when the
   * cart actually changed, not on every render of this provider.
   *
   * These figures are a preview: the server recalculates everything when the order is placed, and
   * its numbers are the ones that count.
   */
  const value = useMemo<CartContextValue>(
    () => ({
      items: state.items,
      orderType: state.orderType,
      totals: calculateTotals(state.items, state.orderType),
      addItem,
      removeItem,
      setQuantity,
      setOrderType,
      clear,
      hydrated,
    }),
    [state.items, state.orderType, addItem, removeItem, setQuantity, setOrderType, clear, hydrated],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/**
 * REACT CONCEPT: custom hook
 *
 * Consumers call useCart() instead of useContext(CartContext). This hides the context object,
 * gives a single place for the "did you forget the provider?" guard, and means the underlying
 * implementation could change without touching a single component.
 */
export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used inside a <CartProvider>');
  }
  return context;
}
