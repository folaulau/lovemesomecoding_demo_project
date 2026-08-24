import {
  DELIVERY_FEE,
  TAX_RATE,
  calculateTotals,
  formatMoney,
  lineTotal,
  round2,
  unitPrice,
} from '../money';
import type { CartItem, Topping } from '@/types';

function topping(id: string, price: number): Topping {
  return { id, name: `Topping ${id}`, price, category: 'MEAT', active: true };
}

function item(overrides: Partial<CartItem> = {}): CartItem {
  return {
    lineId: 'line-1',
    productId: 'product-1',
    productName: 'Pepperoni',
    productType: 'PIZZA',
    imageUrl: null,
    size: 'MEDIUM',
    basePrice: 10.99,
    crustId: null,
    crustName: null,
    crustPriceDelta: 0,
    toppings: [],
    quantity: 1,
    ...overrides,
  };
}

describe('round2', () => {
  it('rounds to cents', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(1.004)).toBe(1);
    expect(round2(10)).toBe(10);
  });

  it('cleans up binary floating point drift', () => {
    // A real pizza: $13.99 base + $1.50 stuffed crust + $1.75 of toppings.
    // In binary floating point that sum is 17.240000000000002, not 17.24.
    expect(13.99 + 1.5 + 1.75).not.toBe(17.24);
    expect(round2(13.99 + 1.5 + 1.75)).toBe(17.24);
  });
});

describe('formatMoney', () => {
  it('formats as US currency', () => {
    expect(formatMoney(14.24)).toBe('$14.24');
    expect(formatMoney(0)).toBe('$0.00');
    expect(formatMoney(1234.5)).toBe('$1,234.50');
  });
});

describe('unitPrice', () => {
  it('is the base price when there is nothing else', () => {
    expect(unitPrice(item())).toBe(10.99);
  });

  it('adds the crust surcharge and every topping', () => {
    const priced = item({
      crustPriceDelta: 1.5,
      toppings: [topping('a', 1.75), topping('b', 1.25)],
    });
    expect(unitPrice(priced)).toBe(15.49);
  });

  it('ignores quantity — it is the price of ONE', () => {
    expect(unitPrice(item({ quantity: 5 }))).toBe(10.99);
  });
});

describe('lineTotal', () => {
  it('multiplies the unit price by the quantity', () => {
    expect(lineTotal(item({ quantity: 3 }))).toBe(32.97);
  });
});

describe('calculateTotals', () => {
  it('is all zeroes for an empty cart, and charges no delivery fee', () => {
    const totals = calculateTotals([], 'DELIVERY');
    expect(totals).toEqual({ subtotal: 0, tax: 0, deliveryFee: 0, total: 0, itemCount: 0 });
  });

  it('adds the delivery fee to a delivery order', () => {
    const totals = calculateTotals([item()], 'DELIVERY');

    expect(totals.subtotal).toBe(10.99);
    expect(totals.tax).toBe(round2(10.99 * TAX_RATE));
    expect(totals.deliveryFee).toBe(DELIVERY_FEE);
    expect(totals.total).toBe(round2(totals.subtotal + totals.tax + totals.deliveryFee));
  });

  it('charges no delivery fee for pickup', () => {
    const totals = calculateTotals([item()], 'CARRYOUT');

    expect(totals.deliveryFee).toBe(0);
    expect(totals.total).toBe(round2(totals.subtotal + totals.tax));
  });

  it('counts every unit, not every line', () => {
    const totals = calculateTotals(
      [item({ lineId: 'a', quantity: 2 }), item({ lineId: 'b', quantity: 3 })],
      'CARRYOUT',
    );
    expect(totals.itemCount).toBe(5);
  });

  it('taxes the subtotal, not the total — the delivery fee is not taxed', () => {
    const totals = calculateTotals([item()], 'DELIVERY');
    expect(totals.tax).toBe(round2(totals.subtotal * TAX_RATE));
  });
});
