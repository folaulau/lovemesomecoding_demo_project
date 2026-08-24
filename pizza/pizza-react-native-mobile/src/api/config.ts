import { Platform } from 'react-native';
import Constants from 'expo-constants';

/** The port `pizza-springboot-backend` serves on. */
const API_PORT = 8085;

/**
 * Where the API lives — the one piece of configuration a mobile app cannot hard-code.
 *
 * <p>On the web, "the backend" is `http://localhost:8085` and that is the end of it, because the
 * browser and the server are on the same machine. Three different things can be running this
 * bundle, and "localhost" means something different to each:
 *
 * <ul>
 *   <li><b>iOS Simulator</b> — shares the Mac's network stack, so `localhost` is the Mac. Works.</li>
 *   <li><b>Android emulator</b> — is a virtual machine. `localhost` is the EMULATOR, and nothing
 *       is listening there. The host machine is reachable at the special address `10.0.2.2`.</li>
 *   <li><b>A real phone</b> — is a different device on the Wi-Fi. It needs the Mac's LAN address,
 *       which changes with the network, so it cannot be written down in advance.</li>
 * </ul>
 *
 * <p>The third case is solved by asking Expo. While the dev server is running, `hostUri` holds the
 * address the phone used to DOWNLOAD this bundle — which is, by definition, a route back to the
 * development machine. Swapping the Metro port for the API port turns it into the API's address.
 *
 * <p>Set `PIZZA_API_URL` to override all of it (see app.config.ts).
 */
function resolveBaseUrl(): string {
  const configured = Constants.expoConfig?.extra?.['apiBaseUrl'];
  if (typeof configured === 'string' && configured.length > 0) {
    return configured.replace(/\/$/, '');
  }

  if (!__DEV__) {
    /*
     * A release build has no dev server to ask, so a real deployment must supply PIZZA_API_URL at
     * build time. Failing loudly beats shipping a binary that silently talks to localhost.
     */
    throw new Error(
      'PIZZA_API_URL must be set for a production build — there is no development server to infer the API host from.',
    );
  }

  /*
   * `hostUri` looks like "192.168.1.42:8081" (LAN) or "localhost:8081" (simulator). Take the host
   * half and drop Metro's port.
   */
  const hostUri = Constants.expoConfig?.hostUri;
  const devHost = hostUri?.split(':')[0];

  if (devHost && devHost !== 'localhost' && devHost !== '127.0.0.1') {
    return `http://${devHost}:${API_PORT}`;
  }

  // Android's emulator alias for "the machine running the emulator".
  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${API_PORT}`;
  }

  return `http://localhost:${API_PORT}`;
}

/**
 * Resolved once, at module load.
 *
 * <p>Deliberate: the value cannot change while the app is running, and recomputing it inside every
 * request would mean paying for the platform checks on each call for no benefit.
 */
export const API_BASE_URL = resolveBaseUrl();

/**
 * The Stripe PUBLISHABLE key.
 *
 * <p>Public by design — it identifies the account and can only create payment intents, never charge
 * one. The secret key lives on the server. If a key starting `sk_` ever appears in this repo,
 * something has gone badly wrong.
 */
export const STRIPE_PUBLISHABLE_KEY: string | undefined =
  (Constants.expoConfig?.extra?.['stripePublishableKey'] as string | undefined) ??
  process.env['EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY'];

export const isStripeConfigured = Boolean(STRIPE_PUBLISHABLE_KEY);
