import { act, renderHook } from '@testing-library/react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { usePaymentGateway } from '../paymentGateway';

/**
 * The Stripe adapter, against a mocked SDK.
 *
 * <p>What is being tested is the TRANSLATION: Stripe reports a dismissed sheet as an error with
 * code 'Canceled', and showing "your payment failed" to somebody who simply changed their mind is
 * the bug this file exists to prevent.
 */

const stripeMock = {
  initPaymentSheet: jest.fn(),
  presentPaymentSheet: jest.fn(),
  retrieveSetupIntent: jest.fn(),
};

jest.mock('@stripe/stripe-react-native', () => ({
  StripeProvider: ({ children }: { children: unknown }) => children,
  useStripe: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  stripeMock.initPaymentSheet.mockResolvedValue({});
  stripeMock.presentPaymentSheet.mockResolvedValue({});
  stripeMock.retrieveSetupIntent.mockResolvedValue({ setupIntent: { paymentMethodId: 'pm_1' } });
  (useStripe as jest.Mock).mockReturnValue(stripeMock);
});

describe('payForOrder', () => {
  it('confirms the intent the SERVER opened, and reports success', async () => {
    const { result } = await renderHook(() => usePaymentGateway());

    let outcome;
    await act(async () => {
      outcome = await result.current.payForOrder({
        clientSecret: 'pi_secret',
        customerName: 'Folau',
        customerEmail: 'folau@example.com',
      });
    });

    expect(outcome).toEqual({ status: 'succeeded' });
    expect(stripeMock.initPaymentSheet).toHaveBeenCalledWith(
      expect.objectContaining({ paymentIntentClientSecret: 'pi_secret' }),
    );
  });

  it('reports a DISMISSED sheet as cancelled, not as a failure', async () => {
    stripeMock.presentPaymentSheet.mockResolvedValue({
      error: { code: 'Canceled', message: 'The payment flow has been canceled' },
    });

    const { result } = await renderHook(() => usePaymentGateway());

    let outcome;
    await act(async () => {
      outcome = await result.current.payForOrder({ clientSecret: 'pi_secret' });
    });

    expect(outcome).toEqual({ status: 'cancelled' });
  });

  it('reports a declined card as a failure, with Stripe’s message', async () => {
    stripeMock.presentPaymentSheet.mockResolvedValue({
      error: { code: 'Failed', message: 'Your card was declined.' },
    });

    const { result } = await renderHook(() => usePaymentGateway());

    let outcome;
    await act(async () => {
      outcome = await result.current.payForOrder({ clientSecret: 'pi_secret' });
    });

    expect(outcome).toEqual({ status: 'failed', message: 'Your card was declined.' });
  });

  it('fails fast when the sheet cannot even be initialised', async () => {
    stripeMock.initPaymentSheet.mockResolvedValue({ error: { message: 'Bad client secret' } });

    const { result } = await renderHook(() => usePaymentGateway());

    let outcome;
    await act(async () => {
      outcome = await result.current.payForOrder({ clientSecret: 'nonsense' });
    });

    expect(outcome).toEqual({ status: 'failed', message: 'Bad client secret' });
    // No point opening a sheet that cannot work.
    expect(stripeMock.presentPaymentSheet).not.toHaveBeenCalled();
  });
});

describe('saveCard', () => {
  it('collects a card against a SetupIntent and returns only the pm_ token', async () => {
    const { result } = await renderHook(() => usePaymentGateway());

    let outcome;
    await act(async () => {
      outcome = await result.current.saveCard('seti_secret');
    });

    expect(outcome).toEqual({ status: 'succeeded', paymentMethodId: 'pm_1' });
    expect(stripeMock.initPaymentSheet).toHaveBeenCalledWith(
      // A SetupIntent, NOT a PaymentIntent — saving a card must never charge it.
      expect.objectContaining({ setupIntentClientSecret: 'seti_secret' }),
    );
  });

  it('treats a dismissed sheet as cancelled here too', async () => {
    stripeMock.presentPaymentSheet.mockResolvedValue({ error: { code: 'Canceled', message: 'x' } });

    const { result } = await renderHook(() => usePaymentGateway());

    let outcome;
    await act(async () => {
      outcome = await result.current.saveCard('seti_secret');
    });

    expect(outcome).toEqual({ status: 'cancelled' });
  });

  it('fails when the SetupIntent comes back without a payment method', async () => {
    stripeMock.retrieveSetupIntent.mockResolvedValue({ setupIntent: {} });

    const { result } = await renderHook(() => usePaymentGateway());

    let outcome;
    await act(async () => {
      outcome = await result.current.saveCard('seti_secret');
    });

    expect(outcome).toMatchObject({ status: 'failed' });
  });
});
