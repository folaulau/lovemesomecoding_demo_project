import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PizzaBuilderSheet } from '../PizzaBuilderSheet';
import type { Crust, Product, Topping } from '@/types';

const PIZZA: Product = {
  id: 'pizza-1',
  name: 'Pepperoni Pizza',
  description: 'Classic pepperoni over mozzarella.',
  type: 'PIZZA',
  imageUrl: null,
  active: true,
  displayOrder: 1,
  sizes: [
    { id: 's', size: 'SMALL', price: 10.99 },
    { id: 'm', size: 'MEDIUM', price: 13.99 },
    { id: 'l', size: 'LARGE', price: 16.99 },
  ],
  createdAt: '',
  updatedAt: '',
};

const DRINK: Product = {
  ...PIZZA,
  id: 'drink-1',
  name: 'Diet Pepsi',
  type: 'DRINK',
  sizes: [{ id: 'm', size: 'MEDIUM', price: 1.99 }],
};

const CRUSTS: Crust[] = [
  { id: 'crust-1', name: 'Original Pan', priceDelta: 0, active: true, displayOrder: 1 },
  { id: 'crust-2', name: 'Stuffed Crust', priceDelta: 2.5, active: true, displayOrder: 2 },
];

const TOPPINGS: Topping[] = [
  { id: 'top-1', name: 'Bacon', price: 1.75, category: 'MEAT', active: true },
  { id: 'top-2', name: 'Mushrooms', price: 1.0, category: 'VEGGIE', active: true },
  { id: 'top-3', name: 'Extra Cheese', price: 1.75, category: 'CHEESE', active: true },
];

/*
 * The `mock` prefix is required, not stylistic.
 *
 * babel-plugin-jest-hoist lifts every `jest.mock()` call above the imports, so a factory that
 * closes over an ordinary `const` would run before that const is initialised. Jest refuses to
 * compile it — except for names beginning with `mock`, which it treats as an explicit promise that
 * the reference is lazy. Which it is: the factory only runs when the module is first required.
 */
const mockAddItem = jest.fn();
const mockShowToast = jest.fn();

jest.mock('@/features/menu/state/MenuProvider', () => {
  const value = {
    products: [],
    pizzas: [],
    drinks: [],
    toppings: TOPPINGS,
    crusts: CRUSTS,
    loading: false,
    error: null,
    reload: jest.fn(),
  };
  return { useMenu: () => value };
});

jest.mock('@/features/cart/state/CartProvider', () => ({
  useCart: () => ({ addItem: mockAddItem }),
}));

jest.mock('@/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderBuilder(product: Product | null, onClose = jest.fn()) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <PizzaBuilderSheet product={product} onClose={onClose} />
    </SafeAreaProvider>,
  );
}

beforeEach(() => jest.clearAllMocks());

describe('PizzaBuilderSheet', () => {
  it('is closed when there is no product', async () => {
    await renderBuilder(null);
    expect(screen.queryByText('Pepperoni Pizza')).toBeNull();
  });

  it('opens on MEDIUM with the first crust and no toppings', async () => {
    await renderBuilder(PIZZA);

    expect(screen.getByText('Pepperoni Pizza')).toBeTruthy();
    // Medium base, Original Pan is free, nothing else.
    expect(screen.getByTestId('builder-total')).toHaveTextContent('$13.99');
  });

  it('reprices live as the size, crust and toppings change', async () => {
    await renderBuilder(PIZZA);

    await fireEvent.press(screen.getByTestId('size-LARGE'));
    expect(screen.getByTestId('builder-total')).toHaveTextContent('$16.99');

    await fireEvent.press(screen.getByTestId('crust-crust-2'));
    expect(screen.getByTestId('builder-total')).toHaveTextContent('$19.49');

    await fireEvent.press(screen.getByTestId('topping-top-1'));
    expect(screen.getByTestId('builder-total')).toHaveTextContent('$21.24');
  });

  it('deselects a topping that is tapped twice', async () => {
    await renderBuilder(PIZZA);

    await fireEvent.press(screen.getByTestId('topping-top-1'));
    expect(screen.getByTestId('builder-total')).toHaveTextContent('$15.74');

    await fireEvent.press(screen.getByTestId('topping-top-1'));
    expect(screen.getByTestId('builder-total')).toHaveTextContent('$13.99');
  });

  it('multiplies by the quantity, and keeps the unit price alongside', async () => {
    await renderBuilder(PIZZA);

    await fireEvent.press(screen.getByLabelText('Increase quantity of Pepperoni Pizza'));

    expect(screen.getByTestId('builder-total')).toHaveTextContent('$27.98');
    expect(screen.getByText('$13.99 each')).toBeTruthy();
  });

  it('adds the whole configuration to the cart, toasts, and closes', async () => {
    const onClose = jest.fn();
    await renderBuilder(PIZZA, onClose);

    await fireEvent.press(screen.getByTestId('size-LARGE'));
    await fireEvent.press(screen.getByTestId('crust-crust-2'));
    await fireEvent.press(screen.getByTestId('topping-top-2'));
    await fireEvent.press(screen.getByTestId('builder-add'));

    expect(mockAddItem).toHaveBeenCalledWith({
      product: PIZZA,
      size: 'LARGE',
      crust: CRUSTS[1],
      toppings: [TOPPINGS[1]],
      quantity: 1,
    });
    expect(mockShowToast).toHaveBeenCalledWith('1 × Pepperoni Pizza added to your cart');
    expect(onClose).toHaveBeenCalled();
  });

  it('shows only the size step for a DRINK — no crust, no toppings', async () => {
    await renderBuilder(DRINK);

    expect(screen.getByText('Diet Pepsi')).toBeTruthy();
    expect(screen.queryByText('Crust')).toBeNull();
    expect(screen.queryByText('Toppings')).toBeNull();
    expect(screen.getByTestId('builder-total')).toHaveTextContent('$1.99');
  });

  it('sends no crust and no toppings for a drink, whatever the pizza state was', async () => {
    await renderBuilder(DRINK);

    await fireEvent.press(screen.getByTestId('builder-add'));

    expect(mockAddItem).toHaveBeenCalledWith(
      expect.objectContaining({ crust: null, toppings: [] }),
    );
  });
});
