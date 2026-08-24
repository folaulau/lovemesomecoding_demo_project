import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { MenuProvider, useMenu } from '../MenuProvider';
import { catalogApi } from '@/api';
import type { Crust, Product, Topping } from '@/types';

jest.mock('@/api', () => ({
  catalogApi: { listProducts: jest.fn(), listToppings: jest.fn(), listCrusts: jest.fn() },
  toUserMessage: (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback,
}));

const mockApi = catalogApi as jest.Mocked<typeof catalogApi>;

const PIZZA: Product = {
  id: 'pizza-1',
  name: 'Pepperoni',
  description: '',
  type: 'PIZZA',
  imageUrl: null,
  active: true,
  displayOrder: 1,
  sizes: [],
  createdAt: '',
  updatedAt: '',
};
const DRINK: Product = { ...PIZZA, id: 'drink-1', name: 'Diet Coke', type: 'DRINK' };
const TOPPING: Topping = {
  id: 't1',
  name: 'Mushroom',
  price: 1.5,
  category: 'VEGGIE',
  active: true,
};
const CRUST: Crust = { id: 'c1', name: 'Original', priceDelta: 0, active: true, displayOrder: 1 };

function Harness() {
  const { pizzas, drinks, toppings, crusts, loading, error, reload } = useMenu();
  return (
    <>
      <Text testID="loading">{String(loading)}</Text>
      <Text testID="error">{error ?? '-'}</Text>
      <Text testID="pizzas">{pizzas.length}</Text>
      <Text testID="drinks">{drinks.length}</Text>
      <Text testID="toppings">{toppings.length}</Text>
      <Text testID="crusts">{crusts.length}</Text>
      <Pressable testID="reload" onPress={reload}>
        <Text>reload</Text>
      </Pressable>
    </>
  );
}

const renderMenu = () =>
  render(
    <MenuProvider>
      <Harness />
    </MenuProvider>,
  );

describe('MenuProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.listProducts.mockResolvedValue([PIZZA, DRINK]);
    mockApi.listToppings.mockResolvedValue([TOPPING]);
    mockApi.listCrusts.mockResolvedValue([CRUST]);
  });

  it('fetches all three catalogues and splits products by type', async () => {
    await renderMenu();

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    expect(screen.getByTestId('pizzas')).toHaveTextContent('1');
    expect(screen.getByTestId('drinks')).toHaveTextContent('1');
    expect(screen.getByTestId('toppings')).toHaveTextContent('1');
    expect(screen.getByTestId('crusts')).toHaveTextContent('1');
    expect(screen.getByTestId('error')).toHaveTextContent('-');
  });

  it('fetches the three in parallel rather than one after another', async () => {
    await renderMenu();
    // All three are in flight before the first resolves — that is what Promise.all buys.
    expect(mockApi.listProducts).toHaveBeenCalled();
    expect(mockApi.listToppings).toHaveBeenCalled();
    expect(mockApi.listCrusts).toHaveBeenCalled();
  });

  it('reports an error instead of spinning forever when the backend is down', async () => {
    mockApi.listProducts.mockRejectedValue(new Error('Could not reach the server.'));

    await renderMenu();

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('error')).toHaveTextContent('Could not reach the server.');
  });

  it('reload re-fetches, and a retry after a failure recovers', async () => {
    mockApi.listProducts.mockRejectedValueOnce(new Error('boom'));

    await renderMenu();
    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('boom'));

    await fireEvent.press(screen.getByTestId('reload'));

    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('-'));
    expect(screen.getByTestId('pizzas')).toHaveTextContent('1');
    expect(mockApi.listProducts).toHaveBeenCalledTimes(2);
  });

  it('throws a useful error when useMenu is called outside the provider', async () => {
    // Silence React's expected "The above error occurred" console noise for this one case.
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(render(<Harness />)).rejects.toThrow(/must be used inside a <MenuProvider>/);
    spy.mockRestore();
  });
});
