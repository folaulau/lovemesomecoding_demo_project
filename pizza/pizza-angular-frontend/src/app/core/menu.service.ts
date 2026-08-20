import { Injectable, computed } from '@angular/core';
import { httpResource } from '@angular/common/http';
import type { Crust, Product, Topping } from './models';

/* ==========================================================================
 * ANGULAR CONCEPT: httpResource
 *
 * The React app's MenuContext writes the fetch out by hand — a loading flag, an error branch, an
 * AbortController, and a cleanup function to cancel the request when the effect re-runs. Its own
 * comment says as much: "this is where a data library like TanStack Query would normally go".
 *
 * Angular ships that library. `httpResource` takes a function returning a URL and gives back
 * signals for the value, the loading state and the error, cancels the in-flight request when the
 * URL changes, and re-fetches on `reload()`. All four of the hand-written pieces, gone.
 *
 * The URL is a FUNCTION, not a string, and that is the point: read a signal inside it and the
 * resource re-fetches whenever that signal changes. None of these three depend on anything, so
 * they fetch once and then only on demand.
 *
 * ⚠️ `httpResource` is marked `@experimental` as of Angular 21. It is used here because it is
 * exactly the concept this file exists to teach, and because this app pins its versions. In
 * production code, weigh that label — the fallback is the hand-rolled version the React app shows.
 *
 * `defaultValue: []` is what lets templates write `products()` without a null check, and is why
 * these signals are typed `Product[]` rather than `Product[] | undefined`.
 * ========================================================================== */
@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly productsResource = httpResource<Product[]>(() => '/api/products', {
    defaultValue: [],
  });
  private readonly toppingsResource = httpResource<Topping[]>(() => '/api/toppings', {
    defaultValue: [],
  });
  private readonly crustsResource = httpResource<Crust[]>(() => '/api/crusts', {
    defaultValue: [],
  });

  /*
   * ⚠️ GOTCHA, paid for once already: reading `resource.value()` THROWS while the resource is in an
   * error state — a `ResourceValueError`, even though `defaultValue: []` is set. The default covers
   * the loading and idle states, not failure.
   *
   * Left unguarded, a backend that is down does not render the "Could not load the menu" alert this
   * service carefully computes; it throws inside the template and blanks the page. `hasValue()` is
   * the guard, and it is why these three are `computed` rather than the resource's own signal.
   */
  readonly products = computed(() =>
    this.productsResource.hasValue() ? this.productsResource.value() : [],
  );
  readonly toppings = computed(() =>
    this.toppingsResource.hasValue() ? this.toppingsResource.value() : [],
  );
  readonly crusts = computed(() =>
    this.crustsResource.hasValue() ? this.crustsResource.value() : [],
  );

  // Derived lists, recomputed only when products actually change.
  readonly pizzas = computed(() => this.products().filter((p) => p.type === 'PIZZA'));
  readonly drinks = computed(() => this.products().filter((p) => p.type === 'DRINK'));

  /*
   * The three requests are independent and run concurrently — `Promise.all` without writing one.
   * The screen is "loading" until all three have landed, because a menu with crusts but no pizzas
   * is not a menu anyone can use.
   */
  readonly loading = computed(
    () =>
      this.productsResource.isLoading() ||
      this.toppingsResource.isLoading() ||
      this.crustsResource.isLoading(),
  );

  readonly error = computed(() => {
    const failure =
      this.productsResource.error() ?? this.toppingsResource.error() ?? this.crustsResource.error();
    return failure ? `Could not load the menu: ${(failure as Error).message}` : null;
  });

  /** Re-fetch, e.g. after an admin edits the menu, or after a failed load. */
  reload(): void {
    this.productsResource.reload();
    this.toppingsResource.reload();
    this.crustsResource.reload();
  }
}
