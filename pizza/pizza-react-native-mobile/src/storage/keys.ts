/**
 * Every persistence key in one place.
 *
 * <p>Typos in a storage key fail silently — the read simply returns null and the app behaves as if
 * the user had never signed in. Naming them once removes that whole class of bug, and makes it
 * obvious what this app leaves on the device.
 */
export const StorageKey = {
  /** The JWT. Goes in the keychain, never in plain storage. */
  AUTH_TOKEN: 'pizza.token',
  /** Which server-side cart belongs to this device. Not a secret — see cartIdStore. */
  CART_ID: 'pizza.cartId',
} as const;

/** The union of the values above — `'pizza.token' | 'pizza.cartId'`. */
export type StorageKeyValue = (typeof StorageKey)[keyof typeof StorageKey];
