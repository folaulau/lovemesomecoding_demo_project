import type { CartItem, OrderType } from '@/types';

/**
 * The cart's state machine — pure, and deliberately free of React.
 *
 * <p>Nothing here imports a hook, a component or the API, which is what makes the whole file unit
 * testable in milliseconds. The provider next door owns the effects; this owns the rules.
 */

export interface CartState {
  items: CartItem[];
  orderType: OrderType;
}

/**
 * Every way the cart can change, as a discriminated union.
 *
 * <p>TypeScript narrows `action.payload` from `action.type`, so the switch below is exhaustively
 * type-checked: add a case here, forget to handle it, and the build fails rather than the cart
 * silently ignoring it.
 */
export type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: { lineId: string } }
  | { type: 'SET_QUANTITY'; payload: { lineId: string; quantity: number } }
  | { type: 'SET_ORDER_TYPE'; payload: { orderType: OrderType } }
  | { type: 'HYDRATE'; payload: CartState }
  | { type: 'CLEAR' };

export const initialCartState: CartState = {
  items: [],
  orderType: 'DELIVERY',
};

/**
 * Two cart lines are "the same" only if the product, size, crust AND topping set all match.
 *
 * <p>Without this, adding a plain pepperoni and a pepperoni with extra cheese would collapse into
 * one line and the customer would be charged for the wrong pizza.
 *
 * <p>The topping ids are sorted before comparing because selection order is not part of the
 * pizza — {pepperoni, mushroom} and {mushroom, pepperoni} are one configuration.
 */
export function isSameConfiguration(a: CartItem, b: CartItem): boolean {
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
 * A pure reducer: the same state plus the same action always produces the same result, and it
 * never mutates its arguments.
 *
 * <p>That is why every branch builds a NEW array with map/filter rather than calling `push` or
 * assigning to `items[i]`. React compares by reference to decide whether to re-render, so mutating
 * in place would update the data without updating the screen.
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
      // Dropping to zero removes the line — it is what a customer expects from a "−" button.
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
