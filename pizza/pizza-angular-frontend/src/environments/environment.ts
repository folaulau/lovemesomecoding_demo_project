/**
 * Build-time configuration.
 *
 * <p>Angular has no `.env` mechanism of its own. Instead the CLI swaps this file for
 * `environment.development.ts` when serving in development — see `fileReplacements` in
 * `angular.json`. The substitution happens at BUILD time, so the value is baked into the bundle
 * and there is nothing to read at runtime.
 *
 * <p>⚠️ Everything in here ships to the browser. Only the PUBLISHABLE Stripe key belongs in this
 * file; the secret key stays on the server, where it is the thing that actually authorises a
 * charge. The React app makes the same split with `VITE_STRIPE_PUBLISHABLE_KEY`.
 */
export const environment = {
  production: true,
  apiBaseUrl: 'http://localhost:8085',
  stripePublishableKey:
    'pk_test_51U5Wc3BeMrxmFducR7hlZ3YwT770EF2DFj8VPmEmqZ7r2sVasfWDRjWMQBvEqdWOSuIGg6RSd8oIcjQ9RblgJxRq00ThBQPY9F',
};
