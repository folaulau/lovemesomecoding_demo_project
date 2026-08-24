import type { ReactNode } from 'react';

/**
 * The payment contract, written once and implemented twice.
 *
 * <p>`@stripe/stripe-react-native` is a NATIVE module: it has no web build, and merely importing it
 * from a web bundle throws. The app runs on web as a development preview (see app.config.ts), so
 * the Stripe dependency is quarantined behind this interface and Metro picks the implementation by
 * platform — `paymentGateway.web.tsx` for web, `paymentGateway.tsx` for iOS and Android. Nothing
 * outside this folder imports Stripe.
 *
 * <p>The payoff beyond web: the checkout screen is testable without a payment provider at all, and
 * swapping Stripe for something else is one file.
 */

export type PaymentOutcome =
  | { status: 'succeeded' }
  /** The customer dismissed the sheet. Not an error — do not show them a red message. */
  | { status: 'cancelled' }
  | { status: 'failed'; message: string };

export type CardSetupOutcome =
  | { status: 'succeeded'; paymentMethodId: string }
  | { status: 'cancelled' }
  | { status: 'failed'; message: string };

export interface PaymentSheetRequest {
  /** From POST /api/orders. The sheet confirms THIS intent — the server already priced it. */
  clientSecret: string;
  /** Shown at the top of Apple's/Google's sheet. */
  customerName?: string | undefined;
  customerEmail?: string | undefined;
}

export interface PaymentGateway {
  /** Opens the native payment sheet and resolves once the customer is done with it. */
  payForOrder: (request: PaymentSheetRequest) => Promise<PaymentOutcome>;
  /** Collects a card against a SetupIntent WITHOUT charging it, for the profile screen. */
  saveCard: (setupIntentClientSecret: string) => Promise<CardSetupOutcome>;
  /** False when no publishable key is configured — the UI explains rather than failing at tap. */
  isReady: boolean;
}

export type StripeProviderComponent = (props: { children: ReactNode }) => ReactNode;
