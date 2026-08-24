import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button } from '../Button';

/**
 * Note the awaits.
 *
 * <p>React Native Testing Library 14 made `render` and `fireEvent` ASYNCHRONOUS, because React 19
 * can render concurrently — the tree is not guaranteed to be committed by the time the call
 * returns. Forgetting an `await` produces the confusing "`render` function has not been called"
 * error from `screen`, which sounds like the opposite problem.
 */
describe('Button', () => {
  it('renders its title and fires onPress', async () => {
    const onPress = jest.fn();
    await render(<Button title="Add to cart" onPress={onPress} />);

    await fireEvent.press(screen.getByText('Add to cart'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders a subtitle when given one', async () => {
    await render(<Button title="Delivery" subtitle="$3.99 fee" onPress={jest.fn()} />);
    expect(screen.getByText('$3.99 fee')).toBeTruthy();
  });

  it('does not fire when disabled', async () => {
    const onPress = jest.fn();
    await render(<Button title="Pay now" onPress={onPress} disabled testID="pay" />);

    await fireEvent.press(screen.getByTestId('pay'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('swaps the label for a spinner while loading, and blocks presses', async () => {
    const onPress = jest.fn();
    await render(<Button title="Pay now" onPress={onPress} loading testID="pay" />);

    // The label is gone — a loading button must not look pressable.
    expect(screen.queryByText('Pay now')).toBeNull();

    await fireEvent.press(screen.getByTestId('pay'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('exposes the accessibility state a screen reader needs', async () => {
    await render(<Button title="Delivery" onPress={jest.fn()} selected testID="delivery" />);

    const button = screen.getByTestId('delivery');
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityState).toMatchObject({ selected: true, disabled: false });
  });

  it('falls back to the title as its accessibility label', async () => {
    await render(<Button title="Checkout" onPress={jest.fn()} />);
    expect(screen.getByLabelText('Checkout')).toBeTruthy();
  });
});
