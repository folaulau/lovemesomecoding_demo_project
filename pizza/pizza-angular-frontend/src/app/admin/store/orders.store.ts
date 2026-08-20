import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import {
  createActionGroup,
  createFeature,
  createReducer,
  createSelector,
  on,
  props,
} from '@ngrx/store';
import { catchError, map, of, switchMap } from 'rxjs';
import { AdminApiService } from '../../core/admin-api.service';
import { toApiFailure, type ApiFailure } from './api-failure';
import type { Order, OrderStatus, UUID } from '../../core/models';

export const OrdersActions = createActionGroup({
  source: 'Admin Orders',
  events: {
    Load: props<{ page: number }>(),
    'Load Success': props<{ orders: Order[]; totalPages: number }>(),
    'Load Failure': props<{ failure: ApiFailure }>(),

    'Page Changed': props<{ page: number }>(),
    'Status Filter Toggled': props<{ status: OrderStatus }>(),
    'Status Filter Cleared': props<Record<string, never>>(),

    'Change Status': props<{ id: UUID; status: OrderStatus }>(),
    'Change Status Success': props<{ order: Order }>(),
    'Change Status Failure': props<{ failure: ApiFailure }>(),
  },
});

interface OrdersState {
  items: Order[];
  page: number;
  totalPages: number;
  /** Which statuses to show. Empty means everything. */
  statusFilter: OrderStatus[];
  loading: boolean;
  error: string | null;
}

const initialState: OrdersState = {
  items: [],
  page: 0,
  totalPages: 1,
  statusFilter: [],
  loading: false,
  error: null,
};

export const ordersFeature = createFeature({
  name: 'adminOrders',
  reducer: createReducer(
    initialState,
    on(OrdersActions.load, (state): OrdersState => ({ ...state, loading: true, error: null })),
    on(
      OrdersActions.loadSuccess,
      (state, { orders, totalPages }): OrdersState => ({
        ...state,
        loading: false,
        items: orders,
        totalPages,
      }),
    ),
    on(
      OrdersActions.loadFailure,
      (state, { failure }): OrdersState => ({ ...state, loading: false, error: failure.message }),
    ),
    on(OrdersActions.pageChanged, (state, { page }): OrdersState => ({ ...state, page })),

    /** Toggle one status in or out of the filter. */
    on(
      OrdersActions.statusFilterToggled,
      (state, { status }): OrdersState => ({
        ...state,
        statusFilter: state.statusFilter.includes(status)
          ? state.statusFilter.filter((s) => s !== status)
          : [...state.statusFilter, status],
      }),
    ),
    on(OrdersActions.statusFilterCleared, (state): OrdersState => ({ ...state, statusFilter: [] })),

    /*
     * Patch the one row that changed rather than refetching the page. The server returns the
     * updated order, so the list stays in step without a second round trip.
     */
    on(
      OrdersActions.changeStatusSuccess,
      (state, { order }): OrdersState => ({
        ...state,
        items: state.items.map((existing) => (existing.id === order.id ? order : existing)),
      }),
    ),
  ),

  /*
   * NGRX CONCEPT: extraSelectors, for the ones that cannot be generated.
   *
   * `createFeature` derives a selector per state field automatically. Anything DERIVED has to be
   * written, and `createSelector` memoises it: the filter only re-runs when `items` or
   * `statusFilter` actually changed, and hands back the identical array reference otherwise — which
   * is what stops every OnPush component reading it from re-rendering.
   *
   * The filtered list is derived rather than stored, deliberately. Derived data in a store is data
   * that can go stale. Same reasoning as `computed()` on the customer side, and as the React app's
   * `selectVisibleOrders`.
   */
  extraSelectors: ({ selectItems, selectStatusFilter }) => ({
    selectVisibleOrders: createSelector(selectItems, selectStatusFilter, (items, statusFilter) =>
      statusFilter.length === 0 ? items : items.filter((o) => statusFilter.includes(o.status)),
    ),
  }),
});

export const ordersEffects = {
  load: createEffect(
    (actions$ = inject(Actions), api = inject(AdminApiService)) =>
      actions$.pipe(
        ofType(OrdersActions.load),
        switchMap(({ page }) =>
          api.listOrders(page, 20).pipe(
            map((result) =>
              OrdersActions.loadSuccess({
                orders: result.content,
                totalPages: result.totalPages,
              }),
            ),
            catchError((err) =>
              of(OrdersActions.loadFailure({ failure: toApiFailure(err, 'Could not load orders') })),
            ),
          ),
        ),
      ),
    { functional: true },
  ),

  /**
   * Turning the page RE-LOADS it.
   *
   * One effect can listen for another feature's action just as easily as its own — that is what
   * keeps the page-turning buttons from having to dispatch two actions and remember the order.
   */
  reloadOnPageChange: createEffect(
    (actions$ = inject(Actions)) =>
      actions$.pipe(
        ofType(OrdersActions.pageChanged),
        map(({ page }) => OrdersActions.load({ page })),
      ),
    { functional: true },
  ),

  changeStatus: createEffect(
    (actions$ = inject(Actions), api = inject(AdminApiService)) =>
      actions$.pipe(
        ofType(OrdersActions.changeStatus),
        switchMap(({ id, status }) =>
          api.updateOrderStatus(id, status).pipe(
            map((order) => OrdersActions.changeStatusSuccess({ order })),
            catchError((err) =>
              of(
                OrdersActions.changeStatusFailure({
                  failure: toApiFailure(err, 'Could not update the order'),
                }),
              ),
            ),
          ),
        ),
      ),
    { functional: true },
  ),
};
