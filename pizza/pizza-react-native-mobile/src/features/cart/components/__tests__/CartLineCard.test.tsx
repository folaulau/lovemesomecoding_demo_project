import { fireEvent, render, screen } from '@testing-library/react-native';
import { CartLineCard } from '../CartLineCard';
import type { CartItem, Topping } from '@/types';

function topping(id: string, name: string, price: number): Topping {
  return { id, name, price, category: 'MEAT', active: true };
}

const LINE: CartItem = {
  lineId: 'line-1',
  productId: 'pizza-1',
  productName: 'Pepperoni Pizza',
  productType: 'PIZZA',
  imageUrl: null,
  size: 'LARGE',
  basePrice: 16.99,
  crustId: 'crust-2',
  crustName: 'Stuffed Crust',
  crustPriceDelta: 2.5,
  toppings: [topping('t1', 'Bacon', 1.75)],
  quantity: 2,
};

describe('CartLineCard', () => {
  it('shows the whole configuration a customer needs to recognise the line', async () => {
    await render(<CartLineCard item={LINE} onQuantityChange={jest.fn()} onRemove={jest.fn()} />);

    expect(screen.getByText('Pepperoni Pizza')).toBeTruthy();
    // "LARGE" would read badly; "Large · Stuffed Crust" does.
    expect(screen.getByText('Large · Stuffed Crust')).toBeTruthy();
    expect(screen.getByText('Bacon')).toBeTruthy();
  });

  it('shows the unit price and the line total, which differ once quantity > 1', async () => {
    await render(<CartLineCard item={LINE} onQuantityChange={jest.fn()} onRemove={jest.fn()} />);

    // 16.99 + 2.50 crust + 1.75 topping = 21.24 each, × 2 = 42.48
    expect(screen.getByText('$21.24 each')).toBeTruthy();
    expect(screen.getByTestId('cart-line-total-line-1')).toHaveTextContent('$42.48');
  });

  it('reports quantity changes against its own line id', async () => {
    const onQuantityChange = jest.fn();
    await render(
      <CartLineCard item={LINE} onQuantityChange={onQuantityChange} onRemove={jest.fn()} />,
    );

    await fireEvent.press(screen.getByLabelText('Increase quantity of Pepperoni Pizza'));
    expect(onQuantityChange).toHaveBeenCalledWith('line-1', 3);

    await fireEvent.press(screen.getByLabelText('Decrease quantity of Pepperoni Pizza'));
    expect(onQuantityChange).toHaveBeenCalledWith('line-1', 1);
  });

  it('removes by line id', async () => {
    const onRemove = jest.fn();
    await render(<CartLineCard item={LINE} onQuantityChange={jest.fn()} onRemove={onRemove} />);

    await fireEvent.press(screen.getByTestId('cart-remove-line-1'));

    expect(onRemove).toHaveBeenCalledWith('line-1');
  });

  it('omits the topping row entirely for a plain line', async () => {
    await render(
      <CartLineCard
        item={{ ...LINE, toppings: [], crustName: null, crustPriceDelta: 0 }}
        onQuantityChange={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    expect(screen.queryByText('Bacon')).toBeNull();
    // No crust means no trailing separator either.
    expect(screen.getByText('Large')).toBeTruthy();
  });
});
