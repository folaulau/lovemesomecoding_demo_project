/*
 * Where the JWT lives.
 *
 * This exists to break an import cycle: http.js needs the token to set the
 * Authorization header, the auth store needs http.js to log in, and a store
 * importing the client that imports the store is a cycle that only works by
 * accident of module hoisting. Both sides depend on this leaf module instead.
 *
 * localStorage rather than an httpOnly cookie is a DEMO choice, and the wrong
 * one for production: any XSS on the page can read it. A real deployment puts
 * the token in an httpOnly SameSite cookie so JavaScript cannot touch it. It is
 * localStorage here because it keeps the auth flow readable in one file, which
 * is the point of a tutorial app.
 */

const TOKEN_KEY = "reelcms.token";
const USER_KEY = "reelcms.user";

/** Fired when the server rejects our token, so the store can react. */
export const SESSION_EXPIRED = "reelcms:session-expired";

export function readToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function readUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) ?? "null");
  } catch {
    // Corrupt JSON in storage should log you out, not crash the app on boot.
    return null;
  }
}

export function writeSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession({ notify = false } = {}) {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  if (notify) window.dispatchEvent(new CustomEvent(SESSION_EXPIRED));
}
