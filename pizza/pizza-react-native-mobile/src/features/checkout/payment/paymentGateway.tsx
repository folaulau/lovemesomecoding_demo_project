import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { StripeProvider as StripeSdkProvider, useStripe } from '@stripe/stripe-react-native';
import { STRIPE_PUBLISHABLE_KEY, isStripeConfigured } from '@/api';
import type {
  CardSetupOutcome,
  PaymentGateway,
  PaymentOutcome,
  PaymentSheetRequest,
} from './types';

/**
 * The NATIVE payment implementation. Metro loads this on iOS and Android.
 *
 * <p>It uses Stripe's **PaymentSheet** rather than a card form of our own. That is the mobile
 * equivalent of the web app's `<PaymentElement>` and it matters for the same reason: the card
 * number never touches our code. The sheet is rendered by Stripe's SDK in its own native view, so
 * this app stays out of PCI scope — and it gets Apple Pay, saved cards and 3D Secure for free.
 *
 * <p>Building a `CardField` by hand is the tempting alternative and it is the wrong call: it
 * handles none of the above, and it puts our JavaScript one refactor away from touching a PAN.
 */

export function StripeProvider({ children }: { children: ReactNode }) {
  if (!isStripeConfigured) {
    /*
     * Render the app anyway. A missing publishable key is a configuration problem, not a reason
     * nobody can browse the menu — checkout is what degrades, and it says so.
     */
    return <>{children}</>;
  }

  return (
    <StripeSdkProvider
      publishableKey={STRIPE_PUBLISHABLE_KEY as string}
      /*
       * `urlScheme` is what brings the customer BACK after a 3D Secure redirect into the bank's
       * page. It must match `scheme` in app.config.ts; get it wrong and the app is simply never
       * reopened, leaving a paid order the customer never sees confirmed.
       */
      urlScheme="pizzaapp"
      merchantIdentifier="merchant.com.lovemesomecoding.pizza"
    >
      {/*
        The fragment is not decoration. StripeProvider types its `children` as ReactElement rather
        than ReactNode, so passing a bare `{children}` — which is ReactNode, and may be undefined —
        does not type-check. Wrapping produces exactly one element and satisfies it.
      */}
      <>{children}</>
    </StripeSdkProvider>
  );
}

export function usePaymentGateway(): PaymentGateway {
  const { initPaymentSheet, presentPaymentSheet, retrieveSetupIntent } = useStripe();

  const payForOrder = useCallback(
    async (request: PaymentSheetRequest): Promise<PaymentOutcome> => {
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'StayHub Pizza',
        paymentIntentClientSecret: request.clientSecret,
        returnURL: 'pizzaapp://stripe-redirect',
        defaultBillingDetails: {
          name: request.customerName,
          email: request.customerEmail,
        },
        // Test mode only. It puts a "4242…" shortcut in the sheet and is ignored in live mode.
        allowsDelayedPaymentMethods: false,
      });

      if (initError) {
        return { status: 'failed', message: initError.message };
      }

      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        /*
         * A dismissed sheet reports as an error with code 'Canceled'. Treating it as a failure
         * would show "Your payment failed" to somebody who simply changed their mind.
         */
        if (presentError.code === 'Canceled') return { status: 'cancelled' };
        return { status: 'failed', message: presentError.message };
      }

      /*
       * Stripe accepted the card. Our order is still PENDING_PAYMENT until the BACKEND hears about
       * it — through the webhook, or through the confirmation screen asking. An order is never
       * marked paid from a device: anyone can call our API.
       */
      return { status: 'succeeded' };
    },
    [initPaymentSheet, presentPaymentSheet],
  );

  const saveCard = useCallback(
    async (setupIntentClientSecret: string): Promise<CardSetupOutcome> => {
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'StayHub Pizza',
        // A SetupIntent, not a PaymentIntent: this collects a card without charging it.
        setupIntentClientSecret,
        returnURL: 'pizzaapp://stripe-redirect',
      });

      if (initError) return { status: 'failed', message: initError.message };

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code === 'Canceled') return { status: 'cancelled' };
        return { status: 'failed', message: presentError.message };
      }

      /*
       * The sheet does not hand back the payment method id, so the SetupIntent is read back to
       * find it. Only that opaque `pm_…` token is sent to our server — never the number, the CVC
       * or the cardholder name.
       */
      const { setupIntent, error: retrieveError } =
        await retrieveSetupIntent(setupIntentClientSecret);

      if (retrieveError || !setupIntent?.paymentMethodId) {
        return {
          status: 'failed',
          message: retrieveError?.message ?? 'The card was accepted but could not be saved.',
        };
      }

      return { status: 'succeeded', paymentMethodId: setupIntent.paymentMethodId };
    },
    [initPaymentSheet, presentPaymentSheet, retrieveSetupIntent],
  );

  return useMemo(
    () => ({ payForOrder, saveCard, isReady: isStripeConfigured }),
    [payForOrder, saveCard],
  );
}
