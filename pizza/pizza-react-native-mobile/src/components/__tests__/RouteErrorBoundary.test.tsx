import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '../RouteErrorBoundary';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

describe('RouteErrorBoundary', () => {
  it('explains the failure and shows the message, rather than a blank screen', async () => {
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ErrorBoundary
          error={new Error('Cannot read property id of undefined')}
          retry={jest.fn()}
        />
      </SafeAreaProvider>,
    );

    expect(screen.getByText('That did not go to plan')).toBeTruthy();
    expect(screen.getByText('Cannot read property id of undefined')).toBeTruthy();
  });

  it('retries when asked', async () => {
    const retry = jest.fn(async () => {});
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ErrorBoundary error={new Error('boom')} retry={retry} />
      </SafeAreaProvider>,
    );

    await fireEvent.press(screen.getByText('Try again'));

    expect(retry).toHaveBeenCalled();
  });
});
