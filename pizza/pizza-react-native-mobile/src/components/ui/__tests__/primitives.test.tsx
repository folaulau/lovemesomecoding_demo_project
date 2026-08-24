import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  Badge,
  Chip,
  EmptyState,
  ErrorState,
  LoadingState,
  PriceRow,
  SegmentedControl,
  Sheet,
  TextField,
} from '..';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Several primitives read safe-area insets, so they need the provider around them. */
const withInsets = (node: React.ReactElement) => (
  <SafeAreaProvider initialMetrics={METRICS}>{node}</SafeAreaProvider>
);

describe('SegmentedControl', () => {
  const SEGMENTS = [
    { value: 'DELIVERY' as const, label: 'Delivery', subtitle: '$3.99 fee' },
    { value: 'CARRYOUT' as const, label: 'Pickup', subtitle: 'No fee' },
  ];

  it('renders every label and subtitle', async () => {
    await render(<SegmentedControl segments={SEGMENTS} value="DELIVERY" onChange={jest.fn()} />);

    expect(screen.getByText('Delivery')).toBeTruthy();
    expect(screen.getByText('$3.99 fee')).toBeTruthy();
    expect(screen.getByText('Pickup')).toBeTruthy();
  });

  it('reports the chosen value, typed', async () => {
    const onChange = jest.fn();
    await render(
      <SegmentedControl
        segments={SEGMENTS}
        value="DELIVERY"
        onChange={onChange}
        testIDPrefix="type"
      />,
    );

    await fireEvent.press(screen.getByTestId('type-CARRYOUT'));

    expect(onChange).toHaveBeenCalledWith('CARRYOUT');
  });

  it('marks the active segment as checked for a screen reader', async () => {
    await render(
      <SegmentedControl
        segments={SEGMENTS}
        value="CARRYOUT"
        onChange={jest.fn()}
        testIDPrefix="t"
      />,
    );

    expect(screen.getByTestId('t-CARRYOUT').props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(screen.getByTestId('t-DELIVERY').props.accessibilityState).toMatchObject({
      checked: false,
    });
  });
});

describe('TextField', () => {
  it('renders the label, marks a required field, and reports typing', async () => {
    const onChangeText = jest.fn();
    await render(
      <TextField label="Email" required value="" onChangeText={onChangeText} testID="email" />,
    );

    expect(screen.getByText('Email *')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('email'), 'folau@example.com');
    expect(onChangeText).toHaveBeenCalledWith('folau@example.com');
  });

  it('shows a hint when there is no error, and swaps to the error when there is', async () => {
    const view = await render(
      <TextField label="ZIP" value="" onChangeText={jest.fn()} hint="Five digits." />,
    );
    expect(screen.getByText('Five digits.')).toBeTruthy();

    await view.rerender(
      <TextField
        label="ZIP"
        value="123"
        onChangeText={jest.fn()}
        hint="Five digits."
        error="Five digits, please."
      />,
    );

    expect(screen.getByText('Five digits, please.')).toBeTruthy();
    // One message at a time — the error replaces the hint rather than stacking under it.
    expect(screen.queryByText('Five digits.')).toBeNull();
  });

  it('labels the input itself, not only the caption above it', async () => {
    await render(<TextField label="City" value="" onChangeText={jest.fn()} />);
    expect(screen.getByLabelText('City')).toBeTruthy();
  });
});

describe('Chip', () => {
  it('renders the label and its price detail, and toggles', async () => {
    const onPress = jest.fn();
    await render(
      <Chip label="Bacon" detail="+$1.75" selected={false} onPress={onPress} testID="bacon" />,
    );

    expect(screen.getByText(/Bacon/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('bacon'));
    expect(onPress).toHaveBeenCalled();
  });

  it('announces itself as a checkbox with its state', async () => {
    await render(<Chip label="Bacon" selected onPress={jest.fn()} testID="bacon" />);

    const chip = screen.getByTestId('bacon');
    expect(chip.props.accessibilityRole).toBe('checkbox');
    expect(chip.props.accessibilityState).toMatchObject({ checked: true });
  });
});

describe('PriceRow', () => {
  it('formats the amount as currency', async () => {
    await render(<PriceRow label="Subtotal" amount={12.5} />);

    expect(screen.getByText('Subtotal')).toBeTruthy();
    expect(screen.getByText('$12.50')).toBeTruthy();
  });
});

describe('Badge', () => {
  it('renders its label', async () => {
    await render(<Badge label="primary" tone="success" />);
    expect(screen.getByText('primary')).toBeTruthy();
  });
});

describe('the three data states', () => {
  it('LoadingState labels its spinner, so it is not silent to a screen reader', async () => {
    await render(<LoadingState label="Loading the menu…" />);
    expect(screen.getByLabelText('Loading the menu…')).toBeTruthy();
  });

  it('EmptyState can offer an action', async () => {
    const onAction = jest.fn();
    await render(
      <EmptyState
        title="Your cart is empty"
        message="Add a pizza."
        actionLabel="Browse"
        onAction={onAction}
      />,
    );

    expect(screen.getByText('Your cart is empty')).toBeTruthy();
    await fireEvent.press(screen.getByText('Browse'));
    expect(onAction).toHaveBeenCalled();
  });

  it('EmptyState omits the button when there is nothing to do', async () => {
    await render(<EmptyState title="No orders yet" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('ErrorState announces itself as an alert and can retry', async () => {
    const onRetry = jest.fn();
    await render(<ErrorState message="Could not load the menu." onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Could not load the menu.')).toBeTruthy();

    await fireEvent.press(screen.getByText('Try again'));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('Sheet', () => {
  it('renders its title, content and footer when visible', async () => {
    await render(
      withInsets(
        <Sheet visible onClose={jest.fn()} title="Your order" footer={<Badge label="footer" />}>
          <Badge label="content" />
        </Sheet>,
      ),
    );

    expect(screen.getByText('Your order')).toBeTruthy();
    expect(screen.getByText('content')).toBeTruthy();
    expect(screen.getByText('footer')).toBeTruthy();
  });

  it('renders nothing when hidden', async () => {
    await render(
      withInsets(
        <Sheet visible={false} onClose={jest.fn()} title="Your order">
          <Badge label="content" />
        </Sheet>,
      ),
    );

    expect(screen.queryByText('content')).toBeNull();
  });

  it('closes from the ✕ button', async () => {
    const onClose = jest.fn();
    await render(
      withInsets(
        <Sheet visible onClose={onClose} title="Your order">
          <Badge label="content" />
        </Sheet>,
      ),
    );

    await fireEvent.press(screen.getByTestId('sheet-close'));
    expect(onClose).toHaveBeenCalled();
  });
});
