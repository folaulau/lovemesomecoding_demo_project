import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CartSheet } from '../CartSheet';
import type { CartItem, OrderType } from '@/types';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

const mockSetOrderType = jest.fn();
const mockSetQuantity = jest.fn();
const mockRemoveItem = jest.fn();

const LINE: CartItem = {
  lineId: 'line-1',
  productId: 'pizza-1',
  productName: 'Pepperoni Pizza',
  productType: 'PIZZA',
  imageUrl: null,
  size: 'MEDIUM',
  basePrice: 13.99,
  crustId: null,
  crustName: null,
  crustPriceDelta: 0,
  toppings: [],
  quantity: 1,
};

/** The cart state the sheet reads. Mutated per test before rendering. */
const mockCart: { items: CartItem[]; orderType: OrderType } = {
  items: [],
  orderType: 'DELIVERY',
};

jest.mock('../../state/CartProvider', () => {
  /*
   * `require` INSIDE the factory, not the import at the top.
   *
   * babel-plugin-jest-hoist lifts this call above every import, so referencing the imported
   * `calculateTotals` here would read an uninitialised binding — Jest refuses to compile it.
   * Requiring lazily, at the moment the factory actually runs, sidesteps that.
   *
   * The real `calculateTotals` is used rather than hard-coded numbers so this test still fails if
   * the tax rate and the sheet ever disagree.
   */
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { calculateTotals: totalsOf } = require('@/domain/money');

  return {
    useCart: () => ({
      items: mockCart.items,
      orderType: mockCart.orderType,
      totals: totalsOf(mockCart.items, mockCart.orderType),
      setOrderType: mockSetOrderType,
      setQuantity: mockSetQuantity,
      removeItem: mockRemoveItem,
    }),
  };
});

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const renderSheet = (onClose = jest.fn()) =>
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <CartSheet visible onClose={onClose} />
    </SafeAreaProvider>,
  );

describe('CartSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCart.items = [];
    mockCart.orderType = 'DELIVERY';
  });

  it('says the cart is empty, and offers no checkout button', async () => {
    await renderSheet();

    expect(screen.getByText('Your cart is empty')).toBeTruthy();
    expect(screen.queryByTestId('cart-checkout')).toBeNull();
  });

  it('lists the lines and totals them, with the delivery fee', async () => {
    mockCart.items = [LINE];
    await renderSheet();

    expect(screen.getByText('Pepperoni Pizza')).toBeTruthy();
    /*
     * By testID, not by the word "Delivery" — that also labels the delivery/pickup segment.
     *
     * And by REGEX, because a PriceRow's testID sits on the row, whose text is "Delivery$3.99".
     * `toHaveTextContent` matches a string exactly in RNTL 14; a pattern matches the part we mean.
     */
    expect(screen.getByTestId('cart-delivery-fee')).toHaveTextContent(/\$3\.99/);
    // 13.99 + 8.5% tax + $3.99 delivery
    expect(screen.getByTestId('cart-total')).toHaveTextContent(/\$19\.17/);
  });

  it('drops the delivery LINE, not just the fee, for pickup', async () => {
    mockCart.items = [LINE];
    mockCart.orderType = 'CARRYOUT';
    await renderSheet();

    // The row is absent entirely — a "$0.00 delivery" line would be noise.
    expect(screen.queryByTestId('cart-delivery-fee')).toBeNull();
    expect(screen.getByTestId('cart-total')).toHaveTextContent(/\$15\.18/);
  });

  it('switches between delivery and pickup', async () => {
    mockCart.items = [LINE];
    await renderSheet();

    await fireEvent.press(screen.getByTestId('cart-order-type-CARRYOUT'));

    expect(mockSetOrderType).toHaveBeenCalledWith('CARRYOUT');
  });

  it('CLOSES BEFORE NAVIGATING — a sheet left mounted over a pushed screen eats every tap', async () => {
    mockCart.items = [LINE];
    const onClose = jest.fn();
    await renderSheet(onClose);

    await fireEvent.press(screen.getByTestId('cart-checkout'));

    expect(onClose).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/checkout');
    // The ordering is the point, so it is asserted rather than assumed.
    expect(onClose.mock.invocationCallOrder[0]).toBeLessThan(mockPush.mock.invocationCallOrder[0]!);
  });

  it('passes line edits through to the cart', async () => {
    mockCart.items = [LINE];
    await renderSheet();

    await fireEvent.press(screen.getByLabelText('Increase quantity of Pepperoni Pizza'));
    expect(mockSetQuantity).toHaveBeenCalledWith('line-1', 2);

    await fireEvent.press(screen.getByTestId('cart-remove-line-1'));
    expect(mockRemoveItem).toHaveBeenCalledWith('line-1');
  });
});
