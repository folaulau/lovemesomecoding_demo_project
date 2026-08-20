import { inject } from '@angular/core';
import { CanActivateFn, CanDeactivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';

/* ==========================================================================
 * ANGULAR CONCEPT: functional route guards
 *
 * A guard runs BEFORE the route's component is created. That is the meaningful difference from
 * React Router, where `<ProtectedRoute>` is itself a component: it has to render, read auth state,
 * and then return a `<Navigate>` — which is why the React version needs an `initialising` spinner
 * to avoid bouncing a valid admin on the frame before the token check finishes.
 *
 * Here the guard simply AWAITS. A `CanActivateFn` may return a boolean, a `UrlTree`, or a promise
 * or observable of either, so the router holds the navigation until the answer is known and the
 * bad frame never exists.
 *
 * Returning a `UrlTree` rather than calling `router.navigate()` matters: it tells the router to
 * REPLACE this navigation, so pressing Back after signing in does not bounce the user straight
 * back to the redirect. It is the same reasoning as `<Navigate replace />` in the React app.
 *
 * ⚠️ NOTE this is a usability guard, not a security control. Anyone can edit client-side
 * JavaScript. The real enforcement is the backend rejecting requests without a valid ADMIN token.
 * ========================================================================== */

export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.whenReady();

  return auth.isAuthenticated() ? true : signIn(router, state.url);
};

export const adminGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.whenReady();

  if (!auth.isAuthenticated()) return signIn(router, state.url);

  // Signed in but not an admin: home, not the login page — signing in again would not help.
  return auth.isAdmin() ? true : router.createUrlTree(['/']);
};

/**
 * The attempted URL rides along in the query string so the login page can send the user back where
 * they were going, instead of dumping them on the home page.
 *
 * <p>Returning a UrlTree rather than calling router.navigate() matters: it tells the router to
 * REPLACE this navigation, so pressing Back after signing in does not bounce the user straight
 * back to the redirect. Same reasoning as Navigate with replace in the React app.
 */
function signIn(router: Router, returnUrl: string): UrlTree {
  return router.createUrlTree(['/login'], { queryParams: { returnUrl } });
}

/* ==========================================================================
 * ANGULAR CONCEPT: CanDeactivateFn — a guard on the way OUT
 *
 * `CanActivateFn` decides whether a route may be entered. `CanDeactivateFn` decides whether it may
 * be LEFT, and it is handed the live component instance — which is the whole point, because only
 * the component knows whether there is anything worth stopping for.
 *
 * React Router's `useBlocker` is the closest equivalent and it works the other way round: the
 * component subscribes to the navigation and blocks it from the inside. Here the router asks, and
 * the component answers.
 *
 * The guard itself is deliberately this thin. Every decision — is there anything to lose, and what
 * should we ask — belongs to the component; putting any of it here would mean a second place to
 * look when checkout changes.
 *
 * Note the return type. A guard may answer with a PROMISE of a boolean, and `Checkout` uses that
 * to hold the navigation open while it asks the question in a modal, resolving once the user picks.
 * That is what makes a real confirmation possible without `window.confirm`, which cannot be styled,
 * cannot be tested through the UI, and blocks the whole tab while it is up.
 *
 * ⚠️ This does NOT fire on a full page load, a reload or a closed tab — those never reach the
 * router. Guarding against those needs a `beforeunload` listener, and browsers deliberately allow
 * it to show only their own generic message.
 * ========================================================================== */

/** Implemented by any component that wants a say in whether it can be navigated away from. */
export interface ConfirmsNavigation {
  canDeactivate(): boolean | Promise<boolean>;
}

export const confirmLeaveGuard: CanDeactivateFn<ConfirmsNavigation> = (component) =>
  component.canDeactivate();
