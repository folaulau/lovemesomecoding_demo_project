import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { MenuService } from '../../core/menu.service';
import type { Product } from '../../core/models';
import { MenuPage } from './menu-page';

/* ==========================================================================
 * ANGULAR CONCEPT: testing a debounced, cancelling search
 *
 * This is the spec that justifies the RxJS in menu-page.ts. Three things need proving and none of
 * them are observable from the rendered output alone:
 *
 *   1. typing does NOT fire a request per keystroke
 *   2. an in-flight request is CANCELLED when a newer term arrives
 *   3. the results reach the template
 *
 * Two tools make it possible. Vitest's fake timers let `debounceTime(300)` be advanced
 * instantly instead of waited out — a real 300 ms sleep per assertion would make this suite slow
 * enough that people stop running it. And `HttpTestingController` exposes `req.cancelled`, which
 * is the only direct evidence that `switchMap` unsubscribed rather than letting both requests run.
 *
 * `MenuService` is replaced with a stub because the real one calls `httpResource` in a field
 * initialiser: constructing it would fire three requests this spec neither cares about nor wants
 * to have to flush.
 * ========================================================================== */

/**
 * Full-shaped fixtures on purpose. `ProductCard` maps over `sizes` to find a price, so a trimmed
 * literal fails deep inside the child component's template rather than in this spec.
 */
function product(id: string, name: string, type: 'PIZZA' | 'DRINK'): Product {
  return {
    id,
    name,
    description: name,
    type,
    imageUrl: null,
    active: true,
    displayOrder: 1,
    sizes: [{ id: `${id}-m`, size: 'MEDIUM', price: 9.99 }],
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
  } as Product;
}

const PEPPERONI = product('p1', 'Pepperoni', 'PIZZA');
const PEPSI = product('d1', 'Pepsi', 'DRINK');

/**
 * The MenuService surface this page's component tree touches.
 *
 * Wider than MenuPage itself needs: the template renders `<app-pizza-builder-modal>`, which injects
 * CartService, which reads `menu.crusts()` and `menu.toppings()` in an effect. Leaving those off
 * the stub fails inside change detection with `this.menu.crusts is not a function` — a stack trace
 * pointing at CartService for a spec about the menu page.
 */
function menuServiceStub(products: Product[] = []) {
  return {
    products: signal(products),
    pizzas: signal(products.filter((p) => p.type === 'PIZZA')),
    drinks: signal(products.filter((p) => p.type === 'DRINK')),
    toppings: signal([]),
    crusts: signal([]),
    loading: signal(false),
    error: signal<string | null>(null),
    reload: () => {},
  };
}

describe('MenuPage search', () => {
  let fixture: ComponentFixture<MenuPage>;
  let component: MenuPage;
  let httpMock: HttpTestingController;

  const SEARCH_URL = (term: string) => `/api/search/products?q=${encodeURIComponent(term)}`;

  beforeEach(() => {
    vi.useFakeTimers();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MenuService, useValue: menuServiceStub([PEPPERONI, PEPSI]) },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MenuPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  /** Push a term through the signal and let the debounce window elapse. */
  function type(term: string): void {
    component.searchTerm.set(term);
    fixture.detectChanges(); // flush the effect behind toObservable
    vi.advanceTimersByTime(300);
    fixture.detectChanges();
  }

  it('shows the whole menu when nothing is typed', () => {
    expect(component.isSearching()).toBe(false);
    expect(component.visibleProducts()).toEqual([PEPPERONI, PEPSI]);
    httpMock.expectNone(() => true);
  });

  it('does not search on a single character', () => {
    type('p');

    expect(component.isSearching()).toBe(false);
    httpMock.expectNone(() => true);
  });

  it('sends one request after the typing stops, not one per keystroke', () => {
    component.searchTerm.set('p');
    fixture.detectChanges();
    component.searchTerm.set('pe');
    fixture.detectChanges();
    component.searchTerm.set('pep');
    fixture.detectChanges();

    // Nothing yet — the debounce window has not elapsed.
    httpMock.expectNone(() => true);

    vi.advanceTimersByTime(300);
    fixture.detectChanges();

    // One request, for the LAST term only.
    httpMock.expectOne(SEARCH_URL('pep')).flush([PEPPERONI]);
    fixture.detectChanges();

    expect(component.visibleProducts()).toEqual([PEPPERONI]);
  });

  it('cancels an in-flight request when a newer term arrives', () => {
    type('pep');
    const first = httpMock.expectOne(SEARCH_URL('pep'));

    // Deliberately do NOT flush the first request: it is still in the air.
    type('pepp');
    const second = httpMock.expectOne(SEARCH_URL('pepp'));

    // This is switchMap doing its job. Without it both requests stay open and the slower one can
    // land last, overwriting the newer results with older ones.
    expect(first.cancelled).toBe(true);
    expect(second.cancelled).toBe(false);

    second.flush([PEPPERONI]);
    fixture.detectChanges();
    expect(component.visibleProducts()).toEqual([PEPPERONI]);
  });

  it('does not refetch when the term has not really changed', () => {
    type('pep');
    httpMock.expectOne(SEARCH_URL('pep')).flush([PEPPERONI]);
    fixture.detectChanges();

    // Trailing whitespace is the same search — map(trim) + distinctUntilChanged.
    type('pep ');

    httpMock.expectNone(() => true);
  });

  it('reports a search that found nothing, once it has come back', () => {
    type('kale');
    expect(component.searchLoading()).toBe(true);
    expect(component.noResults()).toBe(false); // never while it is still running

    httpMock.expectOne(SEARCH_URL('kale')).flush([]);
    fixture.detectChanges();

    expect(component.searchLoading()).toBe(false);
    expect(component.noResults()).toBe(true);
  });

  it('keeps the menu usable when the search request fails', () => {
    type('pep');
    httpMock
      .expectOne(SEARCH_URL('pep'))
      .flush({ message: 'nope' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    // catchError swallowed it: empty results, and — the important part — the stream is still alive.
    expect(component.visibleProducts()).toEqual([]);

    type('pepsi');
    httpMock.expectOne(SEARCH_URL('pepsi')).flush([PEPSI]);
    fixture.detectChanges();
    expect(component.visibleProducts()).toEqual([PEPSI]);
  });

  it('clearSearch returns the page to the full menu', () => {
    type('pep');
    httpMock.expectOne(SEARCH_URL('pep')).flush([PEPPERONI]);
    fixture.detectChanges();

    component.clearSearch();
    fixture.detectChanges();
    vi.advanceTimersByTime(300);
    fixture.detectChanges();

    expect(component.isSearching()).toBe(false);
    expect(component.visibleProducts()).toEqual([PEPPERONI, PEPSI]);
  });
});
