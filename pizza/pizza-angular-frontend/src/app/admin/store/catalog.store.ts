import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { createActionGroup, createFeature, createReducer, emptyProps, on, props } from '@ngrx/store';
import { catchError, map, of, switchMap } from 'rxjs';
import { AdminApiService } from '../../core/admin-api.service';
import { toApiFailure, type ApiFailure } from './api-failure';
import type {
  Crust,
  CrustWriteRequest,
  Product,
  ProductWriteRequest,
  Topping,
  ToppingWriteRequest,
  UUID,
} from '../../core/models';

/* ==========================================================================
 * NGRX CONCEPT: feature boundaries follow the DOMAIN, not the screen
 *
 * Products, toppings and crusts get one feature between them, even though they have a tab each.
 * They are one thing — the menu — and they change together: adding a topping should be visible to
 * the product editor without either page knowing the other exists. Three near-identical features
 * was the alternative, and would have tripled the boilerplate to express that the catalogue is
 * three unrelated things, which is not true.
 *
 * ⚠️ The repetition that IS here (three fetch/save/delete triples) is deliberate. A generic
 * `makeCrudFeature(name, api)` would collapse it into a third of the lines and make every one of
 * them harder to follow — the wrong trade for code that exists to be read.
 *
 * The React app draws exactly the same boundary in `catalogSlice.ts`. What differs is the parts
 * list: RTK's `createSlice` generates the actions from the reducer names and hides the wiring,
 * while NgRx keeps actions, reducer and effects as three visible things. More ceremony, and a
 * clearer answer to "what happened, what changed, and what talked to the network".
 * ========================================================================== */

/**
 * NGRX CONCEPT: createActionGroup.
 *
 * Every action gets a type string like `[Admin Catalog] Load Products Success`. The source in
 * brackets is what makes the DevTools log readable when a dozen features are dispatching at once —
 * it is a convention, but a load-bearing one.
 */
export const CatalogActions = createActionGroup({
  source: 'Admin Catalog',
  events: {
    // ---- products ----
    'Load Products': emptyProps(),
    'Load Products Success': props<{ products: Product[] }>(),
    'Load Products Failure': props<{ failure: ApiFailure }>(),

    /*
     * One action for create AND update.
     *
     * The screen treats them as one thing — the same form, the same validation, the same success
     * message — and the only difference is whether an id exists yet. Splitting them would push
     * that decision into the component for no gain.
     */
    'Save Product': props<{ id?: UUID; body: ProductWriteRequest }>(),
    'Save Product Success': props<{ product: Product }>(),
    'Save Product Failure': props<{ failure: ApiFailure }>(),

    'Deactivate Product': props<{ id: UUID }>(),
    'Deactivate Product Success': props<{ id: UUID }>(),
    'Deactivate Product Failure': props<{ failure: ApiFailure }>(),

    'Delete Product': props<{ id: UUID }>(),
    'Delete Product Success': props<{ id: UUID }>(),
    'Delete Product Failure': props<{ failure: ApiFailure }>(),

    // ---- toppings ----
    'Load Toppings': emptyProps(),
    'Load Toppings Success': props<{ toppings: Topping[] }>(),
    'Load Toppings Failure': props<{ failure: ApiFailure }>(),

    'Save Topping': props<{ id?: UUID; body: ToppingWriteRequest }>(),
    'Save Topping Success': props<{ topping: Topping }>(),
    'Save Topping Failure': props<{ failure: ApiFailure }>(),

    'Delete Topping': props<{ id: UUID }>(),
    'Delete Topping Success': props<{ id: UUID }>(),
    'Delete Topping Failure': props<{ failure: ApiFailure }>(),

    // ---- crusts ----
    'Load Crusts': emptyProps(),
    'Load Crusts Success': props<{ crusts: Crust[] }>(),
    'Load Crusts Failure': props<{ failure: ApiFailure }>(),

    'Save Crust': props<{ id?: UUID; body: CrustWriteRequest }>(),
    'Save Crust Success': props<{ crust: Crust }>(),
    'Save Crust Failure': props<{ failure: ApiFailure }>(),

    'Delete Crust': props<{ id: UUID }>(),
    'Delete Crust Success': props<{ id: UUID }>(),
    'Delete Crust Failure': props<{ failure: ApiFailure }>(),
  },
});

interface CatalogState {
  products: Product[];
  toppings: Topping[];
  crusts: Crust[];
  loading: boolean;
  /** Page-level error. Only a failed LOAD sets this — see the note on the reducer below. */
  error: string | null;
}

const initialState: CatalogState = {
  products: [],
  toppings: [],
  crusts: [],
  loading: false,
  error: null,
};

/** Insert if new, replace if already present — the same shape for all three collections. */
function upsert<T extends { id: UUID }>(list: T[], item: T): T[] {
  return list.some((existing) => existing.id === item.id)
    ? list.map((existing) => (existing.id === item.id ? item : existing))
    : [...list, item];
}

/* ==========================================================================
 * NGRX CONCEPT: createFeature
 *
 * Bundles the reducer with selectors generated from the state's own shape — `selectProducts`,
 * `selectLoading` and so on come out of this call rather than being written by hand. Rename a
 * field and the selector name follows, which is the drift this closes.
 *
 * ⚠️ Note every branch returns a NEW object. NgRx does NOT use Immer, so unlike Redux Toolkit
 * `state.products.push(x)` here is a real mutation and a real bug: the store would hold the new
 * value while every component comparing by reference concludes nothing changed. RTK's reducers
 * look mutable and are not; these look immutable and are.
 * ========================================================================== */
export const catalogFeature = createFeature({
  name: 'adminCatalog',
  reducer: createReducer(
    initialState,

    // ---- loads ----
    on(
      CatalogActions.loadProducts,
      CatalogActions.loadToppings,
      CatalogActions.loadCrusts,
      (state): CatalogState => ({ ...state, loading: true, error: null }),
    ),
    on(CatalogActions.loadProductsSuccess, (state, { products }) => ({
      ...state,
      products,
      loading: false,
    })),
    on(CatalogActions.loadToppingsSuccess, (state, { toppings }) => ({
      ...state,
      toppings,
      loading: false,
    })),
    on(CatalogActions.loadCrustsSuccess, (state, { crusts }) => ({
      ...state,
      crusts,
      loading: false,
    })),

    /*
     * Only a failed LOAD becomes the page-level error.
     *
     * A failed save or delete is already reported where it happened — beside the offending input
     * in the modal, or in a toast — and the component learns about it by awaiting the failure
     * action. Letting those land here too put the same "already exists" message in two places at
     * once: under the form field AND in a banner behind the modal. Shared error state is
     * convenient right up to the point where one failure has more than one right place to be shown.
     * The React app hit this exact bug and fixed it the same way.
     */
    on(
      CatalogActions.loadProductsFailure,
      CatalogActions.loadToppingsFailure,
      CatalogActions.loadCrustsFailure,
      (state, { failure }): CatalogState => ({ ...state, loading: false, error: failure.message }),
    ),

    // ---- mutations patch the list rather than refetching it ----
    // One round trip instead of two, and the table never blanks out mid-edit.
    on(CatalogActions.saveProductSuccess, (state, { product }) => ({
      ...state,
      products: upsert(state.products, product),
    })),
    on(CatalogActions.saveToppingSuccess, (state, { topping }) => ({
      ...state,
      toppings: upsert(state.toppings, topping),
    })),
    on(CatalogActions.saveCrustSuccess, (state, { crust }) => ({
      ...state,
      crusts: upsert(state.crusts, crust),
    })),
    on(CatalogActions.deleteProductSuccess, (state, { id }) => ({
      ...state,
      products: state.products.filter((p) => p.id !== id),
    })),
    on(CatalogActions.deleteToppingSuccess, (state, { id }) => ({
      ...state,
      toppings: state.toppings.filter((t) => t.id !== id),
    })),
    on(CatalogActions.deleteCrustSuccess, (state, { id }) => ({
      ...state,
      crusts: state.crusts.filter((c) => c.id !== id),
    })),
    // The deactivate endpoint returns no body, so flip the flag locally rather than refetch.
    on(CatalogActions.deactivateProductSuccess, (state, { id }) => ({
      ...state,
      products: state.products.map((p) => (p.id === id ? { ...p, active: false } : p)),
    })),
  ),
});

/* ==========================================================================
 * NGRX CONCEPT: effects
 *
 * A reducer must be pure, so it cannot make a request. An effect is where the impurity lives: it
 * listens to the action stream, does the async work, and dispatches the result as another action.
 *
 * Redux Toolkit's `createAsyncThunk` covers the same ground and dispatches pending/fulfilled/
 * rejected for you. The trade is visibility versus brevity: the three actions below are written
 * out, and in exchange every state transition has a name that shows up in the DevTools log.
 *
 * ⚠️ The FLATTENING OPERATOR is the decision that matters, and it has no Redux equivalent because
 * a thunk has no stream to flatten. `switchMap` cancels an in-flight request when a new action of
 * the same type arrives — right for a load, where only the latest answer matters. It would be
 * WRONG for a save: clicking Save twice would cancel the first write mid-flight. Saves and deletes
 * below use `concatMap`-like semantics via `switchMap` only because each one is guarded by a
 * disabled button; where that is not true, reach for `concatMap` or `mergeMap`.
 *
 * ⚠️ And `catchError` goes INSIDE the inner pipe, not outside. On the outer stream it would kill
 * the effect permanently after the first failure — the action stream completes and nothing is ever
 * heard from this effect again. It is the single most common NgRx bug.
 * ========================================================================== */
export const catalogEffects = {
  loadProducts: createEffect(
    (actions$ = inject(Actions), api = inject(AdminApiService)) =>
      actions$.pipe(
        ofType(CatalogActions.loadProducts),
        switchMap(() =>
          api.listProducts().pipe(
            map((products) => CatalogActions.loadProductsSuccess({ products })),
            catchError((err) =>
              of(
                CatalogActions.loadProductsFailure({
                  failure: toApiFailure(err, 'Could not load products'),
                }),
              ),
            ),
          ),
        ),
      ),
    { functional: true },
  ),

  saveProduct: createEffect(
    (actions$ = inject(Actions), api = inject(AdminApiService)) =>
      actions$.pipe(
        ofType(CatalogActions.saveProduct),
        switchMap(({ id, body }) =>
          (id ? api.updateProduct(id, body) : api.createProduct(body)).pipe(
            map((product) => CatalogActions.saveProductSuccess({ product })),
            catchError((err) =>
              of(
                CatalogActions.saveProductFailure({
                  failure: toApiFailure(err, 'Could not save that product'),
                }),
              ),
            ),
          ),
        ),
      ),
    { functional: true },
  ),

  deactivateProduct: createEffect(
    (actions$ = inject(Actions), api = inject(AdminApiService)) =>
      actions$.pipe(
        ofType(CatalogActions.deactivateProduct),
        switchMap(({ id }) =>
          api.deactivateProduct(id).pipe(
            map(() => CatalogActions.deactivateProductSuccess({ id })),
            catchError((err) =>
              of(
                CatalogActions.deactivateProductFailure({
                  failure: toApiFailure(err, 'Could not deactivate that product'),
                }),
              ),
            ),
          ),
        ),
      ),
    { functional: true },
  ),

  deleteProduct: createEffect(
    (actions$ = inject(Actions), api = inject(AdminApiService)) =>
      actions$.pipe(
        ofType(CatalogActions.deleteProduct),
        switchMap(({ id }) =>
          api.deleteProduct(id).pipe(
            map(() => CatalogActions.deleteProductSuccess({ id })),
            catchError((err) =>
              of(
                CatalogActions.deleteProductFailure({
                  failure: toApiFailure(err, 'Could not delete that product'),
                }),
              ),
            ),
          ),
        ),
      ),
    { functional: true },
  ),

  loadToppings: createEffect(
    (actions$ = inject(Actions), api = inject(AdminApiService)) =>
      actions$.pipe(
        ofType(CatalogActions.loadToppings),
        switchMap(() =>
          api.listToppings().pipe(
            map((toppings) => CatalogActions.loadToppingsSuccess({ toppings })),
            catchError((err) =>
              of(
                CatalogActions.loadToppingsFailure({
                  failure: toApiFailure(err, 'Could not load toppings'),
                }),
              ),
            ),
          ),
        ),
      ),
    { functional: true },
  ),

  saveTopping: createEffect(
    (actions$ = inject(Actions), api = inject(AdminApiService)) =>
      actions$.pipe(
        ofType(CatalogActions.saveTopping),
        switchMap(({ id, body }) =>
          (id ? api.updateTopping(id, body) : api.createTopping(body)).pipe(
            map((topping) => CatalogActions.saveToppingSuccess({ topping })),
            catchError((err) =>
              of(
                CatalogActions.saveToppingFailure({
                  failure: toApiFailure(err, 'Could not save that topping'),
                }),
              ),
            ),
          ),
        ),
      ),
    { functional: true },
  ),

  deleteTopping: createEffect(
    (actions$ = inject(Actions), api = inject(AdminApiService)) =>
      actions$.pipe(
        ofType(CatalogActions.deleteTopping),
        switchMap(({ id }) =>
          api.deleteTopping(id).pipe(
            map(() => CatalogActions.deleteToppingSuccess({ id })),
            catchError((err) =>
              of(
                CatalogActions.deleteToppingFailure({
                  failure: toApiFailure(err, 'Could not delete that topping'),
                }),
              ),
            ),
          ),
        ),
      ),
    { functional: true },
  ),

  loadCrusts: createEffect(
    (actions$ = inject(Actions), api = inject(AdminApiService)) =>
      actions$.pipe(
        ofType(CatalogActions.loadCrusts),
        switchMap(() =>
          api.listCrusts().pipe(
            map((crusts) => CatalogActions.loadCrustsSuccess({ crusts })),
            catchError((err) =>
              of(
                CatalogActions.loadCrustsFailure({
                  failure: toApiFailure(err, 'Could not load crusts'),
                }),
              ),
            ),
          ),
        ),
      ),
    { functional: true },
  ),

  saveCrust: createEffect(
    (actions$ = inject(Actions), api = inject(AdminApiService)) =>
      actions$.pipe(
        ofType(CatalogActions.saveCrust),
        switchMap(({ id, body }) =>
          (id ? api.updateCrust(id, body) : api.createCrust(body)).pipe(
            map((crust) => CatalogActions.saveCrustSuccess({ crust })),
            catchError((err) =>
              of(
                CatalogActions.saveCrustFailure({
                  failure: toApiFailure(err, 'Could not save that crust'),
                }),
              ),
            ),
          ),
        ),
      ),
    { functional: true },
  ),

  deleteCrust: createEffect(
    (actions$ = inject(Actions), api = inject(AdminApiService)) =>
      actions$.pipe(
        ofType(CatalogActions.deleteCrust),
        switchMap(({ id }) =>
          api.deleteCrust(id).pipe(
            map(() => CatalogActions.deleteCrustSuccess({ id })),
            catchError((err) =>
              of(
                CatalogActions.deleteCrustFailure({
                  failure: toApiFailure(err, 'Could not delete that crust'),
                }),
              ),
            ),
          ),
        ),
      ),
    { functional: true },
  ),
};
