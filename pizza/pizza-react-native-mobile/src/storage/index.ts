import { secureStorage } from './secureStorage';
import { deviceStorage } from './deviceStorage';
import { StorageKey } from './keys';

/** The JWT, in the OS keystore. */
export const tokenStore = {
  get: () => secureStorage.get(StorageKey.AUTH_TOKEN),
  set: (token: string) => secureStorage.set(StorageKey.AUTH_TOKEN, token),
  clear: () => secureStorage.remove(StorageKey.AUTH_TOKEN),
};

/**
 * Where the device remembers WHICH cart is its own.
 *
 * <p>Only an unguessable UUID is stored — never the cart's contents. The contents live in the
 * database, which is the whole point: force-quitting the app, or opening it a week later, recovers
 * the same basket, re-priced against today's menu.
 */
export const cartIdStore = {
  get: () => deviceStorage.get(StorageKey.CART_ID),
  set: (id: string) => deviceStorage.set(StorageKey.CART_ID, id),
  clear: () => deviceStorage.remove(StorageKey.CART_ID),
};

export { secureStorage, deviceStorage, StorageKey };
