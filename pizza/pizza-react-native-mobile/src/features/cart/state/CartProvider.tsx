import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { cartApi } from '@/api';
import { cartIdStore } from '@/storage';
import { newId } from '@/domain/ids';
import { calculateTotals, type CartTotals } from '@/domain/money';
import { useMenu } from '@/features/menu/state/MenuProvider';
import { cartReducer, initialCartState, type CartState } from './cartReducer';
import type {
  CartItem,
  CartWriteRequest,
  Crust,
  OrderType,
  Product,
  SizeName,
  Topping,
} from '@/types';

/* ==========================================================================
 * The cart: useReducer for the rules, effects for the persistence.
 *
 * The cart is needed by the tab-bar badge, the menu, the cart sheet and checkout. Threading it
 * through props would mean passing it through every component in between; context lets any
 * descendant read it directly.
 *
 * useReducer rather than useState because cart updates are a small set of well-defined operations,
 * several of which depend on the previous state. The reducer lives next door in cartReducer.ts and
 * is tested on its own.
 *
 * PERSISTENCE. The cart is saved to the BACKEND, so force-quitting the app does not lose the
 * basket. Only the cart's UUID is kept on the device. Three effects do it:
 *
 *   1. HYDRATE on mount — if the device remembers a cart UUID, fetch that cart and load it.
 *   2. PERSIST on change — debounced PUT of the whole cart.
 *   3. FLUSH on background — see below. This one has no web equivalent and matters a great deal.
 * ========================================================================== */

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
 * `undefined` as the default is deliberate: it lets the hook below detect a component rendered
 * outside the provider and throw a clear error, instead of silently handing back an empty cart
 * that never updates.
 */
const CartContext = createContext<CartContextValue | undefined>(undefined);

/** How long to wait after the last change before writing. Three taps on "+" become one PUT. */
const PERSIST_DEBOUNCE_MS = 300;

/** Turn the device's cart lines into the identifiers-only shape the API accepts. */
function toWriteRequest(state: CartState): CartWriteRequest {
  return {
    orderType: state.orderType,
    items: state.items.map((item) => ({
      productId: item.productId,
      size: item.size,
      crustId: item.crustId,
      toppingIds: item.toppings.map((topping) => topping.id),
      quantity: item.quantity,
    })),
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialCartState);
  const [hydrated, setHydrated] = useState(false);

  // The catalogue is needed to rebuild a saved line's base price and crust surcharge.
  const { products, crusts, loading: menuLoading } = useMenu();

  /*
   * Refs, not state. The persist effect needs the CURRENT cart id and the CURRENT cart without
   * re-running when either changes — re-running on the id would fire an extra PUT, and the
   * background flush below needs to read the latest cart from inside a listener that was
   * registered once.
   */
  const cartIdRef = useRef<string | null>(null);
  const stateRef = useRef(state);

  /*
   * Mirroring state into the ref happens in an EFFECT, not during render.
   *
   * `stateRef.current = state` in the render body is the shorter spelling and it is a render side
   * effect — React may render a component without committing it, which would leave the ref
   * describing a cart the user never saw. An effect only runs on a committed render.
   */
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  /* -------------------------------------------------------------- 1. hydrate */
  useEffect(() => {
    // Wait for the menu: a saved line stores only ids, so prices come from the catalogue.
    if (menuLoading) return;

    const controller = new AbortController();
    let cancelled = false;

    async function hydrate() {
      /*
       * Reading the id is ASYNC here — it is in AsyncStorage. The web app read localStorage
       * synchronously and could seed `useRef` with the value at construction time; this cannot,
       * which is why the ref starts null and is filled in below.
       */
      const cartId = await cartIdStore.get();
      cartIdRef.current = cartId;

      if (!cartId) {
        if (!cancelled) setHydrated(true);
        return;
      }

      try {
        const cart = await cartApi.get(cartId, controller.signal);
        if (cancelled) return;

        const items: CartItem[] = cart.items.map((line) => {
          const product = products.find((p) => p.id === line.productId);
          const crust = crusts.find((c) => c.id === line.crustId);

          return {
            // A fresh device-local key. The server's line id is not reused, because a line's
            // identity here is "this configuration", not a database row.
            lineId: newId(),
            productId: line.productId,
            productName: line.productName,
            productType: line.productType,
            imageUrl: product?.imageUrl ?? null,
            size: line.size,
            basePrice: product?.sizes.find((s) => s.size === line.size)?.price ?? 0,
            crustId: line.crustId,
            crustName: line.crustName,
            crustPriceDelta: crust?.priceDelta ?? 0,
            toppings: line.toppings.map((topping) => ({
              id: topping.toppingId,
              name: topping.toppingName,
              price: topping.price,
              // Not stored on a cart line; only id, name and price are needed to re-price.
              category: 'MEAT' as const,
              active: true,
            })),
            quantity: line.quantity,
          };
        });

        dispatch({ type: 'HYDRATE', payload: { items, orderType: cart.orderType } });
      } catch {
        // The saved cart is gone (deleted, or a stale id from another environment). Forget it
        // rather than leaving the device pointing at a cart that will never load.
        if (!cancelled) {
          await cartIdStore.clear();
          cartIdRef.current = null;
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [menuLoading, products, crusts]);

  /**
   * Write the cart, creating one server-side first if this device has never had one.
   *
   * <p>Shared by the debounced effect and the background flush, so there is one implementation of
   * "what does saving mean" rather than two that can drift.
   */
  const persist = useCallback(async () => {
    try {
      let cartId = cartIdRef.current;

      if (!cartId) {
        // Do not create a cart row just because someone opened the app.
        if (stateRef.current.items.length === 0) return;
        const created = await cartApi.create();
        cartId = created.id;
        cartIdRef.current = cartId;
        await cartIdStore.set(cartId);
      }

      await cartApi.replace(cartId, toWriteRequest(stateRef.current));
    } catch {
      // A failed save must not break the screen. The cart still works in this session; it just
      // will not survive a relaunch. A toast on every tap would be worse than the failure.
    }
  }, []);

  /* -------------------------------------------------------------- 2. persist (debounced) */
  useEffect(() => {
    // Never write before hydrating — that would overwrite the saved cart with an empty one.
    if (!hydrated) return;

    const timer = setTimeout(() => void persist(), PERSIST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [state, hydrated, persist]);

  /* -------------------------------------------------------------- 3. flush on background */
  useEffect(() => {
    if (!hydrated) return;

    /*
     * THE MOBILE-ONLY PROBLEM.
     *
     * A browser tab stays alive until the user closes it, so a 300 ms debounce always gets to
     * fire. A phone does not work that way: the moment the app is backgrounded the OS may suspend
     * its JavaScript, and it may kill the process outright to reclaim memory — without warning and
     * without running any pending timer. A customer who adds a pizza and immediately switches apps
     * would lose it.
     *
     * `AppState` is the notification that this is about to happen. Flushing on 'background' turns
     * a lost cart into a saved one. It is the closest native analogue to the web's
     * `visibilitychange`, and the reason `persist` reads from a ref rather than a closure: this
     * listener is registered once and must see the LATEST cart, not the cart as it was at
     * registration.
     */
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        void persist();
      }
    });

    // Removing the listener on unmount is not optional — subscriptions are global and leak.
    return () => subscription.remove();
  }, [hydrated, persist]);

  /*
   * useCallback on everything handed out through context.
   *
   * Without it a new function identity would be created on every render, changing the context
   * value every time and defeating the React.memo on the product cards below it.
   */
  const addItem = useCallback((input: AddItemInput) => {
    const basePrice = input.product.sizes.find((s) => s.size === input.size)?.price ?? 0;

    dispatch({
      type: 'ADD_ITEM',
      payload: {
        lineId: newId(),
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
   * Totals are DERIVED from the items rather than stored alongside them — one source of truth, so
   * they cannot disagree. useMemo means consumers re-render only when the cart actually changed.
   *
   * These figures are a preview. The server recalculates everything when the order is placed, and
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

export function useCart(): CartContextValue {
  const context = use(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used inside a <CartProvider>');
  }
  return context;
}
