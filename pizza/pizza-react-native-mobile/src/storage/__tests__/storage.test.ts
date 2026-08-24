import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cartIdStore, tokenStore, StorageKey } from '..';

/**
 * These prove WHERE each value goes, which is the part that matters.
 *
 * <p>A refactor that quietly moved the JWT from the keychain to AsyncStorage would break no screen
 * and no other test — it would just silently weaken the app. That is exactly the kind of regression
 * a test should catch.
 */
describe('tokenStore', () => {
  afterEach(async () => {
    await tokenStore.clear();
    jest.clearAllMocks();
  });

  it('round-trips a token', async () => {
    await tokenStore.set('jwt-abc');
    await expect(tokenStore.get()).resolves.toBe('jwt-abc');
  });

  it('returns null when nothing has been stored', async () => {
    await expect(tokenStore.get()).resolves.toBeNull();
  });

  it('clears the token', async () => {
    await tokenStore.set('jwt-abc');
    await tokenStore.clear();
    await expect(tokenStore.get()).resolves.toBeNull();
  });

  it('uses SECURE storage — the keychain, not plain key/value storage', async () => {
    await tokenStore.set('jwt-abc');

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(StorageKey.AUTH_TOKEN, 'jwt-abc');
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
});

describe('cartIdStore', () => {
  afterEach(async () => {
    await cartIdStore.clear();
    jest.clearAllMocks();
  });

  it('round-trips a cart id', async () => {
    await cartIdStore.set('cart-uuid');
    await expect(cartIdStore.get()).resolves.toBe('cart-uuid');
  });

  it('uses plain device storage — a cart id is not a secret', async () => {
    await cartIdStore.set('cart-uuid');

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(StorageKey.CART_ID, 'cart-uuid');
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('survives a storage failure instead of crashing the cart', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'));

    // A cart id that cannot be read is a cart that starts empty — never an unhandled rejection.
    await expect(cartIdStore.get()).resolves.toBeNull();
  });
});
