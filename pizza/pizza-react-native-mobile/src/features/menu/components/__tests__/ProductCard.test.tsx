import { fireEvent, render, screen } from '@testing-library/react-native';
import { ProductCard } from '../ProductCard';
import type { Product } from '@/types';

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'pizza-1',
    name: 'Pepperoni',
    description: 'Classic pepperoni and mozzarella.',
    type: 'PIZZA',
    imageUrl: null,
    active: true,
    displayOrder: 1,
    sizes: [
      { id: 's', size: 'SMALL', price: 9.99 },
      { id: 'm', size: 'MEDIUM', price: 12.99 },
      { id: 'l', size: 'LARGE', price: 15.99 },
    ],
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

describe('ProductCard', () => {
  it('shows the name, the description and the CHEAPEST size price', async () => {
    await render(<ProductCard product={product()} onSelect={jest.fn()} />);

    expect(screen.getByText('Pepperoni')).toBeTruthy();
    expect(screen.getByText('Classic pepperoni and mozzarella.')).toBeTruthy();
    expect(screen.getByText('$9.99')).toBeTruthy();
  });

  it('hands the whole product back on press', async () => {
    const onSelect = jest.fn();
    const item = product();
    await render(<ProductCard product={item} onSelect={onSelect} />);

    await fireEvent.press(screen.getByTestId('product-card-pizza-1'));

    expect(onSelect).toHaveBeenCalledWith(item);
  });

  it('says "Build it" for a pizza and "Add" for a drink', async () => {
    const view = await render(<ProductCard product={product()} onSelect={jest.fn()} />);
    expect(screen.getByText('Build it →')).toBeTruthy();

    await view.rerender(
      <ProductCard
        product={product({ id: 'drink-1', type: 'DRINK', name: 'Diet Coke' })}
        onSelect={jest.fn()}
      />,
    );
    expect(screen.getByText('Add →')).toBeTruthy();
  });

  it('says "Unavailable" rather than "from $Infinity" when a product has no sizes', async () => {
    // Math.min() of an empty list is Infinity — the guard in the component is what stops that
    // reaching a customer, and this is the test that keeps it there.
    await render(<ProductCard product={product({ sizes: [] })} onSelect={jest.fn()} />);

    expect(screen.getByText('Unavailable')).toBeTruthy();
    expect(screen.queryByText(/Infinity/)).toBeNull();
  });
});
