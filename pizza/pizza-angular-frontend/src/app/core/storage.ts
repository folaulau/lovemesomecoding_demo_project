/**
 * The two things this app remembers in the browser, and nothing else.
 *
 * <p>⚠️ localStorage is readable by any JavaScript on the page, so a single XSS bug leaks the JWT.
 * It is used here because it is simple, survives a refresh, and works identically for the React
 * and Angular builds. A production app would prefer an HttpOnly cookie, which JavaScript cannot
 * read at all — at the cost of needing a CSRF story.
 *
 * <p>These are plain objects rather than Angular services on purpose: the HTTP interceptor needs
 * the token, and reaching for the injector from inside a functional interceptor to fetch a value
 * this simple would be ceremony without benefit. Injectables earn their keep when they hold STATE
 * or need swapping in a test; a `localStorage` key does neither.
 */

const TOKEN_KEY = 'pizza.token';

export const tokenStore = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/**
 * Where the browser remembers WHICH cart is its own.
 *
 * Only an unguessable UUID is stored — never the cart's contents. The contents live in the
 * database, which is the whole point: a refresh, a second tab, or a crashed browser all recover
 * the same basket.
 */
const CART_ID_KEY = 'pizza.cartId';

export const cartIdStore = {
  get: (): string | null => localStorage.getItem(CART_ID_KEY),
  set: (id: string) => localStorage.setItem(CART_ID_KEY, id),
  clear: () => localStorage.removeItem(CART_ID_KEY),
};
