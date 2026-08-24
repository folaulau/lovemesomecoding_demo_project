import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text, Pressable } from 'react-native';
import { CartProvider, useCart } from '../CartProvider';
import { cartApi } from '@/api';
import { cartIdStore } from '@/storage';
import type { Crust, Product, ServerCart, Topping } from '@/types';

/**
 * The cart's PERSISTENCE, which is the part with the interesting failure modes.
 *
 * <p>The reducer is tested next door in isolation. What is exercised here is everything around it:
 * the debounce, the "never write before hydrating" rule, and recovery from a saved cart that no
 * longer exists — each of which has a bug that would only show up on a second launch.
 */

const PIZZA: Product = {
  id: 'pizza-1',
  name: 'Pepperoni',
  description: 'Classic.',
  type: 'PIZZA',
  imageUrl: null,
  active: true,
  displayOrder: 1,
  sizes: [{ id: 'm', size: 'MEDIUM', price: 12.99 }],
  createdAt: '',
  updatedAt: '',
};

const CRUST: Crust = {
  id: 'crust-1',
  name: 'Original',
  priceDelta: 0,
  active: true,
  displayOrder: 1,
};
const TOPPING: Topping = {
  id: 'top-1',
  name: 'Mushroom',
  price: 1.5,
  category: 'VEGGIE',
  active: true,
};

/*
 * The menu provider is mocked rather than rendered.
 *
 * CartProvider only needs `products`, `crusts` and `loading` from it. Mocking keeps this test off
 * the network and makes "the menu is still loading" a state we can set deliberately, which is
 * awkward to arrange with the real provider.
 *
 * ⚠️ THE VALUE IS BUILT ONCE, outside the hook. Returning a fresh object literal — and therefore a
 * fresh `products` ARRAY — on every call gives the cart's hydrate effect a new dependency on every
 * render, so it re-runs, dispatches, re-renders, and the test hangs in an infinite loop. The real
 * MenuProvider memoises exactly this, which is why the app does not have the problem; a careless
 * mock is what reintroduces it.
 */
jest.mock('@/features/menu/state/MenuProvider', () => {
  const menuValue = {
    products: [PIZZA],
    crusts: [CRUST],
    toppings: [TOPPING],
    pizzas: [PIZZA],
    drinks: [],
    loading: false,
    error: null,
    reload: jest.fn(),
  };
  return { useMenu: () => menuValue };
});

jest.mock('@/api', () => ({
  cartApi: {
    create: jest.fn(),
    get: jest.fn(),
    replace: jest.fn(),
  },
}));

const mockCartApi = cartApi as jest.Mocked<typeof cartApi>;

/** A tiny harness that exposes the cart's behaviour through the UI, the way a screen would. */
function Harness() {
  const { items, totals, addItem, hydrated } = useCart();

  return (
    <>
      <Text testID="hydrated">{String(hydrated)}</Text>
      <Text testID="count">{totals.itemCount}</Text>
      <Text testID="lines">{items.length}</Text>
      <Text testID="first">{items[0]?.productName ?? '-'}</Text>
      <Pressable
        testID="add"
        onPress={() =>
          addItem({
            product: PIZZA,
            size: 'MEDIUM',
            crust: CRUST,
            toppings: [TOPPING],
            quantity: 1,
          })
        }
      >
        <Text>add</Text>
      </Pressable>
    </>
  );
}

async function renderCart() {
  return render(
    <CartProvider>
      <Harness />
    </CartProvider>,
  );
}

/**
 * Wait out the provider's 300 ms persist debounce.
 *
 * <p>Real timers, not `jest.useFakeTimers()`. Faking timers here also fakes the ones AsyncStorage's
 * mock and React's scheduler use, and the test then deadlocks waiting for a promise that only a
 * real tick will resolve. Half a second of real waiting across the suite is the cheaper trade.
 */
async function flushDebounce() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 400));
  });
}

/** Let mounting effects and their awaited promises settle. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('CartProvider', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await cartIdStore.clear();
  });

  it('starts empty and marks itself hydrated when the device remembers no cart', async () => {
    await renderCart();
    await settle();

    await waitFor(() => {
      expect(screen.getByTestId('hydrated')).toHaveTextContent('true');
    });
    expect(screen.getByTestId('count')).toHaveTextContent('0');
    // Crucially, it did NOT create a cart row just because the app launched.
    expect(mockCartApi.create).not.toHaveBeenCalled();
  });

  it('does not write an empty cart to the server', async () => {
    await renderCart();
    await settle();
    await flushDebounce();

    expect(mockCartApi.create).not.toHaveBeenCalled();
    expect(mockCartApi.replace).not.toHaveBeenCalled();
  });

  it('creates a cart on the first item, then PUTs the whole cart', async () => {
    mockCartApi.create.mockResolvedValue({ id: 'cart-99' } as ServerCart);
    mockCartApi.replace.mockResolvedValue({} as ServerCart);

    await renderCart();
    await settle();

    await fireEvent.press(screen.getByTestId('add'));
    await flushDebounce();

    await waitFor(() => expect(mockCartApi.replace).toHaveBeenCalled());

    expect(mockCartApi.create).toHaveBeenCalledTimes(1);
    expect(mockCartApi.replace).toHaveBeenCalledWith('cart-99', {
      orderType: 'DELIVERY',
      items: [
        {
          productId: 'pizza-1',
          size: 'MEDIUM',
          crustId: 'crust-1',
          toppingIds: ['top-1'],
          quantity: 1,
        },
      ],
    });

    // The id is remembered so the next launch can find the same cart.
    await expect(cartIdStore.get()).resolves.toBe('cart-99');
  });

  it('sends IDENTIFIERS only — never a price the server should be deciding', async () => {
    mockCartApi.create.mockResolvedValue({ id: 'cart-99' } as ServerCart);
    mockCartApi.replace.mockResolvedValue({} as ServerCart);

    await renderCart();
    await settle();
    await fireEvent.press(screen.getByTestId('add'));
    await flushDebounce();

    await waitFor(() => expect(mockCartApi.replace).toHaveBeenCalled());

    const [, body] = mockCartApi.replace.mock.calls[0]!;
    expect(JSON.stringify(body)).not.toMatch(/price|total|12\.99/i);
  });

  it('debounces: three quick taps are ONE write, not three', async () => {
    mockCartApi.create.mockResolvedValue({ id: 'cart-99' } as ServerCart);
    mockCartApi.replace.mockResolvedValue({} as ServerCart);

    await renderCart();
    await settle();

    await fireEvent.press(screen.getByTestId('add'));
    await fireEvent.press(screen.getByTestId('add'));
    await fireEvent.press(screen.getByTestId('add'));
    await flushDebounce();

    await waitFor(() => expect(mockCartApi.replace).toHaveBeenCalled());

    expect(mockCartApi.replace).toHaveBeenCalledTimes(1);
    // All three landed on one line, because the configuration is identical.
    expect(screen.getByTestId('count')).toHaveTextContent('3');
    expect(screen.getByTestId('lines')).toHaveTextContent('1');
  });

  it('rehydrates a saved cart, re-pricing it from the current menu', async () => {
    await cartIdStore.set('cart-42');
    mockCartApi.get.mockResolvedValue({
      id: 'cart-42',
      orderType: 'CARRYOUT',
      items: [
        {
          id: 'server-line-1',
          productId: 'pizza-1',
          productName: 'Pepperoni',
          productType: 'PIZZA',
          size: 'MEDIUM',
          crustId: 'crust-1',
          crustName: 'Original',
          quantity: 2,
          toppings: [{ toppingId: 'top-1', toppingName: 'Mushroom', price: 1.5 }],
          unitPrice: 14.49,
          lineTotal: 28.98,
        },
      ],
      subtotal: 28.98,
      tax: 2.46,
      deliveryFee: 0,
      total: 31.44,
      itemCount: 2,
    });

    await renderCart();
    await settle();

    await waitFor(() => {
      expect(screen.getByTestId('first')).toHaveTextContent('Pepperoni');
    });
    expect(mockCartApi.get).toHaveBeenCalledWith('cart-42', expect.anything());
    expect(screen.getByTestId('count')).toHaveTextContent('2');
  });

  it('forgets a saved cart the server no longer has, rather than retrying forever', async () => {
    await cartIdStore.set('cart-gone');
    mockCartApi.get.mockRejectedValue(new Error('404'));

    await renderCart();
    await settle();

    await waitFor(() => {
      expect(screen.getByTestId('hydrated')).toHaveTextContent('true');
    });
    expect(screen.getByTestId('count')).toHaveTextContent('0');
    await expect(cartIdStore.get()).resolves.toBeNull();
  });

  it('never overwrites a saved cart with an empty one while it is still loading', async () => {
    await cartIdStore.set('cart-42');

    // A fetch that never settles — the provider is stuck mid-hydration.
    mockCartApi.get.mockReturnValue(new Promise(() => {}));

    await renderCart();
    await settle();
    await flushDebounce();

    expect(screen.getByTestId('hydrated')).toHaveTextContent('false');
    // THE bug this guard exists for: a PUT here would wipe the customer's saved basket.
    expect(mockCartApi.replace).not.toHaveBeenCalled();
  });
});
