import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import { catalogEffects, catalogFeature } from './catalog.store';
import { ordersEffects, ordersFeature } from './orders.store';
import { reportsEffects, reportsFeature } from './reports.store';
import { usersEffects, usersFeature } from './users.store';

/* ==========================================================================
 * WHERE THE STORE IS PROVIDED — the decision this whole app is arranged around
 *
 * The four FEATURES and their effects are attached to the /admin ROUTE, not to `app.config.ts`.
 * That placement is doing two jobs, and they are the same two the React app gets from putting
 * `<Provider>` inside `AdminLayout` rather than in `main.tsx`.
 *
 * The first is architectural. The customer-facing pages run on signal services and cannot reach
 * this state even by accident, so "NgRx for admin, signals for customers" is enforced by the
 * injector rather than by everyone remembering it.
 *
 * The second is the bundle. /admin is a lazy route, so every reducer, selector, effect and action
 * string below arrives only when an admin opens it.
 *
 * ⚠️ WHAT WILL NOT MOVE, and the hour it cost to learn: `provideStore()` HAS to be at the root.
 * Put it here with the features and the app compiles, serves, and then dies on the first admin
 * navigation with `NG0201: No provider found for _Store` — thrown from `EffectsRunner_Factory`.
 * `EffectsRunner` is `providedIn: 'root'` and injects the Store, so it resolves from the ROOT
 * injector, where a route-provided store does not exist. The stack trace is the only clue; nothing
 * fails at build time.
 *
 * So `provideStore()` lives in `app.config.ts`, and the NgRx runtime it pulls in costs the entry
 * bundle 15.9 kB raw / 4.4 kB over the wire — measured, by building with and without it.
 * Everything SPECIFIC to admin is still lazy: the four features, the ten effects and every action
 * string land in a 4.6 kB chunk (937 bytes transferred) that only an admin ever fetches.
 *
 * That is the honest version of the claim. The React app's version — where `<Provider>` inside a
 * lazy `AdminLayout` really does keep every last byte of Redux out of the entry bundle — is the
 * cleaner split, and it is worth knowing that Angular cannot quite match it here.
 * ========================================================================== */

export function provideAdminStore(): EnvironmentProviders {
  /*
   * ⚠️ `makeEnvironmentProviders`, not a plain array.
   *
   * Returning `[provideStore(), …]` and spreading it into a route's `providers` looks equivalent
   * and is not: the nested array of `EnvironmentProviders` does not register, and the first
   * component to `inject(Store)` fails with `NG0201: No provider found for _Store` — at runtime,
   * on navigation, with nothing at build time to warn you. Wrapping them makes this ONE
   * `EnvironmentProviders` value, which a route knows how to install.
   */
  return makeEnvironmentProviders([
    provideState(catalogFeature),
    provideState(ordersFeature),
    provideState(reportsFeature),
    provideState(usersFeature),
    provideEffects(catalogEffects, ordersEffects, reportsEffects, usersEffects),
  ]);
}
