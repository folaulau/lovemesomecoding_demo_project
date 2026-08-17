import { loadStripe } from '@stripe/stripe-js';
import type { Stripe } from '@stripe/stripe-js';

/**
 * The Stripe.js loader.
 *
 * <p>Called at MODULE level, deliberately — `loadStripe` injects a script tag and returns a
 * promise, so calling it inside a component would fire a fresh load on every render. Doing it once
 * here means Stripe.js is fetched a single time for the whole app.
 *
 * <p>Only the PUBLISHABLE key belongs here. Everything in this bundle is downloaded by the browser
 * and readable by anyone; the secret key stays on the server and is what actually authorises a
 * charge.
 */
const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

export const stripePromise: Promise<Stripe | null> = publishableKey
  ? loadStripe(publishableKey)
  : Promise.resolve(null);

export const isStripeConfigured = Boolean(publishableKey);
