import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Encrypted-at-rest storage for secrets.
 *
 * <p>This is the first real departure from the web app. There, the JWT lives in `localStorage`,
 * with a comment apologising that any XSS bug can read it. On a phone there is a better answer:
 * `expo-secure-store` writes to the iOS **Keychain** and the Android **EncryptedSharedPreferences**,
 * both backed by the OS keystore. Another app cannot read it, and on iOS it survives an app
 * reinstall only if you ask it to.
 *
 * <p>Two consequences the web version does not have:
 *
 * <ol>
 *   <li>Every call is ASYNC. `localStorage.getItem` returns a string; this returns a Promise. That
 *       is why {@link AuthProvider} has an "initialising" state at all — the token cannot be read
 *       synchronously during the first render.</li>
 *   <li>There is a size limit (~2 KB on Android). Fine for a JWT, wrong for anything bulky.</li>
 * </ol>
 *
 * <p>WEB FALLBACK. `expo-secure-store` has no web implementation and throws if called there. The
 * app runs on web only as a development preview (see app.config.ts), so it degrades to
 * AsyncStorage — which on web is localStorage, i.e. exactly the web app's trade-off. The guard is
 * `Platform.OS`, evaluated once at module load.
 */

const isWeb = Platform.OS === 'web';

export const secureStorage = {
  async get(key: string): Promise<string | null> {
    if (isWeb) return AsyncStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },

  async set(key: string, value: string): Promise<void> {
    if (isWeb) return AsyncStorage.setItem(key, value);
    return SecureStore.setItemAsync(key, value);
  },

  async remove(key: string): Promise<void> {
    if (isWeb) return AsyncStorage.removeItem(key);
    return SecureStore.deleteItemAsync(key);
  },
};
