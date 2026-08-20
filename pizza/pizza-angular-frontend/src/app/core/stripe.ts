import { loadStripe } from '@stripe/stripe-js';
import type { Stripe } from '@stripe/stripe-js';
import { environment } from '../../environments/environment';

/**
 * The Stripe.js loader.
 *
 * <p>Called at MODULE level, deliberately — `loadStripe` injects a script tag and returns a
 * promise, so calling it inside a component would fire a fresh load every time that component was
 * created. Doing it once here means Stripe.js is fetched a single time for the whole app.
 *
 * <p>Only the PUBLISHABLE key belongs here. Everything in this bundle is downloaded by the browser
 * and readable by anyone; the secret key stays on the server and is what actually authorises a
 * charge.
 *
 * <p>There is no `@stripe/react-stripe-js` equivalent for Angular, so the components use Stripe's
 * plain JavaScript API directly: `stripe.elements({ clientSecret })`, `elements.create('payment')`,
 * `.mount(el)`. That is a few more lines than `<Elements><PaymentElement /></Elements>`, and it
 * shows what the React wrapper is actually doing underneath.
 */
const publishableKey = environment.stripePublishableKey;

export const stripePromise: Promise<Stripe | null> = publishableKey
  ? loadStripe(publishableKey)
  : Promise.resolve(null);

export const isStripeConfigured = Boolean(publishableKey);

/** Stripe Elements styled to match the app. Shared by checkout and the profile's card form. */
export const stripeAppearance = {
  theme: 'stripe' as const,
  variables: { colorPrimary: '#d8102a' },
};
