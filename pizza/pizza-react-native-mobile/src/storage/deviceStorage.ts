import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Plain, unencrypted key/value storage — the phone's equivalent of `localStorage`.
 *
 * <p>Use this for things that are inconvenient to lose but harmless to leak. The cart id qualifies:
 * it is an unguessable UUID naming a row in our database, and knowing it reveals nothing about the
 * customer. Anything an attacker could USE goes in {@link secureStorage} instead.
 *
 * <p>The thin wrapper exists so that swapping AsyncStorage for MMKV later touches one file, and so
 * that a failed read cannot crash a screen: storage on a device can genuinely fail (no space,
 * corrupted store), and a cart id is never worth an error boundary.
 */
export const deviceStorage = {
  async get(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },

  async set(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // Non-fatal: the cart still works in memory, it just will not survive a relaunch.
    }
  },

  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // Same reasoning as above.
    }
  },
};
