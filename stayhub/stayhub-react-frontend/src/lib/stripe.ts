import { loadStripe, type Stripe } from '@stripe/stripe-js'

/** `loadStripe` returns a PROMISE and must be called ONCE, outside any component.
 *
 * Calling it during a render creates a new Stripe instance on every render and re-downloads
 * Stripe.js. Module scope is the idiomatic place — the promise is created at import time and
 * every <Elements> shares it.
 */
let cached: Promise<Stripe | null> | null = null

export function getStripe(publishableKey?: string): Promise<Stripe | null> {
  const key = publishableKey || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  if (!key) return Promise.resolve(null)
  cached ??= loadStripe(key)
  return cached
}

export const stripeConfigured = Boolean(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
