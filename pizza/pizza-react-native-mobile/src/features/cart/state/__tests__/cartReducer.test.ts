import {
  cartReducer,
  initialCartState,
  isSameConfiguration,
  type CartState,
} from '../cartReducer';
import type { CartItem, Topping } from '@/types';

function topping(id: string): Topping {
  return { id, name: `Topping ${id}`, price: 1.5, category: 'MEAT', active: true };
}

function line(overrides: Partial<CartItem> = {}): CartItem {
  return {
    lineId: 'line-1',
    productId: 'pizza-1',
    productName: 'Pepperoni',
    productType: 'PIZZA',
    imageUrl: null,
    size: 'MEDIUM',
    basePrice: 12.99,
    crustId: 'crust-1',
    crustName: 'Original',
    crustPriceDelta: 0,
    toppings: [],
    quantity: 1,
    ...overrides,
  };
}

describe('isSameConfiguration', () => {
  it('matches identical configurations', () => {
    expect(isSameConfiguration(line({ lineId: 'a' }), line({ lineId: 'b' }))).toBe(true);
  });

  it.each([
    ['product', { productId: 'pizza-2' }],
    ['size', { size: 'LARGE' as const }],
    ['crust', { crustId: 'crust-2' }],
  ])('does not match when the %s differs', (_label, difference) => {
    expect(isSameConfiguration(line(), line(difference))).toBe(false);
  });

  it('does not match when the topping sets differ', () => {
    expect(isSameConfiguration(line({ toppings: [topping('a')] }), line())).toBe(false);
    expect(
      isSameConfiguration(line({ toppings: [topping('a')] }), line({ toppings: [topping('b')] })),
    ).toBe(false);
  });

  it('ignores the ORDER toppings were picked in', () => {
    // {pepperoni, mushroom} and {mushroom, pepperoni} are the same pizza.
    const a = line({ toppings: [topping('a'), topping('b')] });
    const b = line({ toppings: [topping('b'), topping('a')] });
    expect(isSameConfiguration(a, b)).toBe(true);
  });
});

describe('cartReducer', () => {
  describe('ADD_ITEM', () => {
    it('appends a new line', () => {
      const next = cartReducer(initialCartState, { type: 'ADD_ITEM', payload: line() });
      expect(next.items).toHaveLength(1);
      expect(next.items[0]?.productName).toBe('Pepperoni');
    });

    it('bumps the quantity of a matching line instead of adding a second one', () => {
      const state: CartState = { items: [line({ quantity: 2 })], orderType: 'DELIVERY' };

      const next = cartReducer(state, {
        type: 'ADD_ITEM',
        payload: line({ lineId: 'line-2', quantity: 3 }),
      });

      expect(next.items).toHaveLength(1);
      expect(next.items[0]?.quantity).toBe(5);
      // The ORIGINAL line id survives — it is the line that was already there.
      expect(next.items[0]?.lineId).toBe('line-1');
    });

    it('keeps a differently-topped pizza as its own line', () => {
      const state: CartState = { items: [line()], orderType: 'DELIVERY' };

      const next = cartReducer(state, {
        type: 'ADD_ITEM',
        payload: line({ lineId: 'line-2', toppings: [topping('extra-cheese')] }),
      });

      expect(next.items).toHaveLength(2);
    });
  });

  describe('SET_QUANTITY', () => {
    it('sets the quantity of the named line only', () => {
      const state: CartState = {
        items: [line({ lineId: 'a' }), line({ lineId: 'b', productId: 'pizza-2' })],
        orderType: 'DELIVERY',
      };

      const next = cartReducer(state, {
        type: 'SET_QUANTITY',
        payload: { lineId: 'a', quantity: 4 },
      });

      expect(next.items[0]?.quantity).toBe(4);
      expect(next.items[1]?.quantity).toBe(1);
    });

    it('removes the line when the quantity drops to zero', () => {
      const state: CartState = { items: [line()], orderType: 'DELIVERY' };

      const next = cartReducer(state, {
        type: 'SET_QUANTITY',
        payload: { lineId: 'line-1', quantity: 0 },
      });

      expect(next.items).toHaveLength(0);
    });

    it('removes the line for a negative quantity too', () => {
      const state: CartState = { items: [line()], orderType: 'DELIVERY' };

      const next = cartReducer(state, {
        type: 'SET_QUANTITY',
        payload: { lineId: 'line-1', quantity: -3 },
      });

      expect(next.items).toHaveLength(0);
    });
  });

  it('REMOVE_ITEM drops only the named line', () => {
    const state: CartState = {
      items: [line({ lineId: 'a' }), line({ lineId: 'b', productId: 'pizza-2' })],
      orderType: 'DELIVERY',
    };

    const next = cartReducer(state, { type: 'REMOVE_ITEM', payload: { lineId: 'a' } });

    expect(next.items).toHaveLength(1);
    expect(next.items[0]?.lineId).toBe('b');
  });

  it('SET_ORDER_TYPE leaves the items alone', () => {
    const state: CartState = { items: [line()], orderType: 'DELIVERY' };

    const next = cartReducer(state, {
      type: 'SET_ORDER_TYPE',
      payload: { orderType: 'CARRYOUT' },
    });

    expect(next.orderType).toBe('CARRYOUT');
    expect(next.items).toBe(state.items);
  });

  it('HYDRATE replaces everything', () => {
    const state: CartState = { items: [line()], orderType: 'DELIVERY' };
    const saved: CartState = { items: [line({ lineId: 'saved' })], orderType: 'CARRYOUT' };

    expect(cartReducer(state, { type: 'HYDRATE', payload: saved })).toEqual(saved);
  });

  it('CLEAR empties the items but keeps the order type', () => {
    const state: CartState = { items: [line()], orderType: 'CARRYOUT' };

    const next = cartReducer(state, { type: 'CLEAR' });

    expect(next.items).toHaveLength(0);
    expect(next.orderType).toBe('CARRYOUT');
  });

  describe('purity', () => {
    it('never mutates the state it was given', () => {
      const state: CartState = { items: [line()], orderType: 'DELIVERY' };
      const snapshot = JSON.parse(JSON.stringify(state));

      cartReducer(state, { type: 'ADD_ITEM', payload: line({ lineId: 'x', productId: 'p2' }) });
      cartReducer(state, { type: 'REMOVE_ITEM', payload: { lineId: 'line-1' } });
      cartReducer(state, { type: 'SET_QUANTITY', payload: { lineId: 'line-1', quantity: 9 } });
      cartReducer(state, { type: 'CLEAR' });

      expect(state).toEqual(snapshot);
    });

    it('returns a NEW items array, so React sees the change', () => {
      const state: CartState = { items: [line()], orderType: 'DELIVERY' };

      const next = cartReducer(state, {
        type: 'SET_QUANTITY',
        payload: { lineId: 'line-1', quantity: 2 },
      });

      // Reference inequality is the whole mechanism React re-renders on.
      expect(next.items).not.toBe(state.items);
    });
  });
});
