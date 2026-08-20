import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, map, of, startWith, switchMap } from 'rxjs';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { MenuService } from '../../core/menu.service';
import { ProductCard } from '../../shared/product-card/product-card';
import { PizzaBuilderModal } from '../../shared/pizza-builder-modal/pizza-builder-modal';
import { Spinner } from '../../shared/spinner/spinner';
import type { Product, ProductType } from '../../core/models';

type Filter = 'ALL' | ProductType;

/** Below this, searching is noise — one letter matches most of the menu. */
const MIN_SEARCH_LENGTH = 2;

/** How long the typist has to stop before a request goes out. */
const SEARCH_DEBOUNCE_MS = 300;

type SearchState = { loading: boolean; results: Product[] | null };

const IDLE: SearchState = { loading: false, results: null };

@Component({
  selector: 'app-menu-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProductCard, PizzaBuilderModal, Spinner],
  templateUrl: './menu-page.html',
})
export class MenuPage {
  private readonly menu = inject(MenuService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  /* ==========================================================================
   * ANGULAR CONCEPT: a query parameter bound straight to an input
   *
   * `withComponentInputBinding()` in app.config.ts makes the router assign matching route params
   * and query params to `input()`s on the routed component. `?type=PIZZA` arrives here as a signal
   * with no `ActivatedRoute` injected and no subscription to clean up — the tidiest form of React
   * Router's `useSearchParams`.
   *
   * The filter lives in the URL rather than in component state on purpose, in both apps:
   * /menu?type=PIZZA is then shareable, bookmarkable, and survives a refresh. Treating the URL as
   * state is usually the right call for anything a user might want to link to.
   * ========================================================================== */
  readonly type = input<Filter | undefined>(undefined);

  readonly filters: Array<{ key: Filter; label: string }> = [
    { key: 'ALL', label: 'Everything' },
    { key: 'PIZZA', label: 'Pizzas' },
    { key: 'DRINK', label: 'Drinks' },
  ];

  readonly activeFilter = computed<Filter>(() => this.type() ?? 'ALL');

  readonly loading = this.menu.loading;
  readonly error = this.menu.error;

  /* ==========================================================================
   * ANGULAR CONCEPT: signals and observables, and the bridge between them
   *
   * This is the one place in the app where RxJS is unambiguously the right tool. Everywhere else
   * the state is a VALUE — the cart, the current user, the menu — and a signal holds a value
   * better than a stream does. Search is not a value. It is a sequence of events over time that
   * needs debouncing and cancelling, and those are operators, not state.
   *
   * So the pipeline starts and ends in signals and is an observable only in the middle:
   *
   *   searchTerm (signal)  ->  toObservable  ->  operators  ->  toSignal  ->  template
   *
   * `toObservable` and `toSignal` live in `@angular/core/rxjs-interop` and exist precisely so you
   * do not have to pick one model for the whole app.
   *
   * WHAT EACH OPERATOR IS BUYING:
   *
   *   debounceTime(300)     one request when the typing stops, not one per keystroke.
   *   map(trim)             " pep " and "pep" are the same search.
   *   distinctUntilChanged  re-typing the same term after a backspace does not refetch.
   *   switchMap             THE important one. If a response for "pep" is still in flight when
   *                         "pepp" is typed, switchMap UNSUBSCRIBES from it — the request is
   *                         cancelled and its result can never arrive late and overwrite the newer
   *                         one. That out-of-order bug is why `mergeMap` is the wrong choice here,
   *                         and it is the single best argument for RxJS in an app otherwise built
   *                         on signals. The React app solves it with an AbortController by hand.
   *   startWith             emits the loading state for THIS request, inside the switchMap, so a
   *                         cancelled request's spinner is cancelled with it.
   *   catchError            returns an empty result rather than killing the stream. An error that
   *                         escapes here would complete the observable and the search box would go
   *                         dead for the rest of the page's life — the classic RxJS foot-gun.
   * ========================================================================== */
  readonly searchTerm = signal('');

  private readonly trimmedTerm = computed(() => this.searchTerm().trim());

  /** True once the term is worth sending. Drives which list the template renders. */
  readonly isSearching = computed(() => this.trimmedTerm().length >= MIN_SEARCH_LENGTH);

  private readonly searchState = toSignal(
    toObservable(this.searchTerm).pipe(
      debounceTime(SEARCH_DEBOUNCE_MS),
      map((term) => term.trim()),
      distinctUntilChanged(),
      switchMap((term) => {
        if (term.length < MIN_SEARCH_LENGTH) return of(IDLE);

        return this.api
          .get<Product[]>(`/api/search/products?q=${encodeURIComponent(term)}`)
          .pipe(
            map((results): SearchState => ({ loading: false, results })),
            // A failed search shows "nothing found" rather than a red alert over the whole menu.
            // The menu itself is still on screen and still usable.
            catchError(() => of<SearchState>({ loading: false, results: [] })),
            startWith<SearchState>({ loading: true, results: null }),
          );
      }),
    ),
    { initialValue: IDLE },
  );

  readonly searchLoading = computed(() => this.searchState().loading);

  readonly visibleProducts = computed(() => {
    // A search cuts across the type tabs deliberately: someone typing "pepsi" wants the drink even
    // if they left the Pizzas tab selected.
    if (this.isSearching()) return this.searchState().results ?? [];

    const filter = this.activeFilter();
    const products = this.menu.products();
    return filter === 'ALL' ? products : products.filter((p) => p.type === filter);
  });

  /** Shown only once a search has actually come back empty, never while it is still running. */
  readonly noResults = computed(
    () => this.isSearching() && !this.searchLoading() && this.visibleProducts().length === 0,
  );

  /** `null` means the builder is closed. One piece of state, not two. */
  readonly selectedProduct = signal<Product | null>(null);

  applyFilter(filter: Filter): void {
    void this.router.navigate(['/menu'], {
      queryParams: filter === 'ALL' ? {} : { type: filter },
    });
  }

  clearSearch(): void {
    this.searchTerm.set('');
  }

  reload(): void {
    this.menu.reload();
  }
}
