import * as Crypto from 'expo-crypto';

/**
 * A random UUID.
 *
 * <p>The web app calls `crypto.randomUUID()`, which browsers provide. Hermes does not: React Native
 * has no Web Crypto API, and `crypto` is simply undefined. Reaching for `Math.random()` is the
 * usual mistake — it is not a cryptographic source, and cart line ids that can collide produce a
 * bug that only shows up under load.
 *
 * <p>`expo-crypto` bridges to the platform's real random source (SecRandomCopyBytes on iOS,
 * SecureRandom on Android). Wrapping it here means the rest of the app never has to know that.
 */
export function newId(): string {
  return Crypto.randomUUID();
}
