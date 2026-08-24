import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider, useToast } from '../ToastProvider';

function Harness() {
  const { showToast } = useToast();
  return (
    <>
      <Pressable testID="ok" onPress={() => showToast('Added to your cart')}>
        <Text>ok</Text>
      </Pressable>
      <Pressable testID="bad" onPress={() => showToast('Could not save the card.', 'danger')}>
        <Text>bad</Text>
      </Pressable>
    </>
  );
}

const renderToasts = () =>
  render(
    /*
     * `initialMetrics` gives the safe-area provider real numbers. Without them it waits for a
     * native measurement that never arrives under Jest, and every child renders with zero insets
     * one tick late — which is enough to make a query miss.
     */
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ToastProvider>
        <Harness />
      </ToastProvider>
    </SafeAreaProvider>,
  );

describe('ToastProvider', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows a toast on request', async () => {
    await renderToasts();

    await fireEvent.press(screen.getByTestId('ok'));

    expect(screen.getByText('Added to your cart')).toBeTruthy();
  });

  it('stacks several at once', async () => {
    await renderToasts();

    await fireEvent.press(screen.getByTestId('ok'));
    await fireEvent.press(screen.getByTestId('bad'));

    expect(screen.getByText('Added to your cart')).toBeTruthy();
    expect(screen.getByText('Could not save the card.')).toBeTruthy();
  });

  it('dismisses itself after three seconds', async () => {
    jest.useFakeTimers();
    await renderToasts();

    await fireEvent.press(screen.getByTestId('ok'));
    expect(screen.getByText('Added to your cart')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(3100);
    });

    expect(screen.queryByText('Added to your cart')).toBeNull();
  });

  it('renders nothing at all when the queue is empty', async () => {
    await renderToasts();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('throws a useful error when useToast is called outside the provider', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(render(<Harness />)).rejects.toThrow(/must be used inside a <ToastProvider>/);
    spy.mockRestore();
  });
});
