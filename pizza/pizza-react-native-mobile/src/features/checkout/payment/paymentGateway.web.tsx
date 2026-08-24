import { useMemo } from 'react';
import type { ReactNode } from 'react';
import type { CardSetupOutcome, PaymentGateway, PaymentOutcome } from './types';

/**
 * The WEB implementation. Metro loads this instead of `paymentGateway.tsx` when the platform is
 * web, because of the `.web` extension — no bundler configuration, no conditional import.
 *
 * <p>It is a stub, and honestly so. `@stripe/stripe-react-native` wraps the iOS and Android Stripe
 * SDKs and has no web build at all; importing it here would break the bundle. The web target exists
 * only to preview screens in a browser and to run the Playwright smoke suite, so payment is the one
 * flow that genuinely cannot be exercised there.
 *
 * <p>It reports `isReady: false` rather than throwing, so the checkout screen renders its
 * "payment unavailable" branch — which is the same branch a missing Stripe key produces on device.
 * One code path, tested in the browser, that also covers a real misconfiguration.
 *
 * <p>The real web answer, if this app ever needed one, is `@stripe/stripe-js` with `<PaymentElement>`
 * — which is exactly what `pizza-react-frontend` does.
 */

const UNAVAILABLE = 'Card payment is only available in the iOS and Android builds.';

export function StripeProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function usePaymentGateway(): PaymentGateway {
  return useMemo(
    () => ({
      payForOrder: async (): Promise<PaymentOutcome> => ({
        status: 'failed',
        message: UNAVAILABLE,
      }),
      saveCard: async (): Promise<CardSetupOutcome> => ({
        status: 'failed',
        message: UNAVAILABLE,
      }),
      isReady: false,
    }),
    [],
  );
}
