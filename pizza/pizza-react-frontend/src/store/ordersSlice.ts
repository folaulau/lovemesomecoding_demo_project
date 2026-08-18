import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { adminApi } from '../lib/adminApi';
import type { Order, OrderStatus, UUID } from '../types';

/* ==========================================================================
 * REDUX CONCEPT: a slice
 *
 * A slice bundles together the three things that always travel as a set — the initial state, the
 * reducers that change it, and the action creators that trigger them. Classic Redux made you
 * write all three by hand and keep them in sync; createSlice generates the action creators and
 * their type strings from the reducer names.
 *
 * `state.page = page` inside a reducer looks like a mutation and would be a bug in a plain React
 * reducer. It is safe here because Redux Toolkit runs every reducer inside Immer, which records
 * the writes against a draft and produces a new immutable object from them. The rule that state
 * is never mutated still holds — Immer is just doing the copying.
 * ========================================================================== */

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

/* ==========================================================================
 * REDUX CONCEPT: createAsyncThunk
 *
 * A reducer must be pure, so it cannot make a request. A thunk is the escape hatch: an action
 * creator that returns a function instead of an object, giving it somewhere to do async work
 * before dispatching the real actions.
 *
 * createAsyncThunk dispatches three actions for you — pending, fulfilled and rejected — which is
 * why the loading flag and the error string below never have to be set by hand from a component.
 * That triple is the same loading/error/data shape MenuContext writes out longhand on the
 * customer side; here it comes for free.
 * ========================================================================== */
export const fetchOrders = createAsyncThunk(
  'orders/fetch',
  async (page: number) => adminApi.listOrders(page, 20),
);

export const changeOrderStatus = createAsyncThunk(
  'orders/changeStatus',
  async ({ id, status }: { id: UUID; status: OrderStatus }) =>
    adminApi.updateOrderStatus(id, status),
);

const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    pageChanged(state, action: PayloadAction<number>) {
      state.page = action.payload;
    },

    /** Toggle one status in or out of the filter. */
    statusFilterToggled(state, action: PayloadAction<OrderStatus>) {
      const status = action.payload;
      state.statusFilter = state.statusFilter.includes(status)
        ? state.statusFilter.filter((s) => s !== status)
        : [...state.statusFilter, status];
    },

    statusFilterCleared(state) {
      state.statusFilter = [];
    },
  },

  /*
   * `extraReducers` responds to actions this slice did not define — here, the ones
   * createAsyncThunk generates. It is also how two slices react to the same event without
   * importing each other.
   */
  extraReducers: (builder) => {
    builder
      .addCase(fetchOrders.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.content;
        state.totalPages = action.payload.totalPages;
      })
      .addCase(fetchOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Could not load orders.';
      })
      /*
       * Patch the one row that changed rather than refetching the page. The server returns the
       * updated order, so the list can be kept in step without a second round trip.
       */
      .addCase(changeOrderStatus.fulfilled, (state, action) => {
        const updated = action.payload;
        state.items = state.items.map((order) => (order.id === updated.id ? updated : order));
      });
  },
});

export const { pageChanged, statusFilterToggled, statusFilterCleared } = ordersSlice.actions;
export const ordersReducer = ordersSlice.reducer;

/* ==========================================================================
 * REDUX CONCEPT: selectors
 *
 * A selector is a plain function from state to the bit of it a component wants. Keeping them
 * here rather than inline in components means the state SHAPE stays an implementation detail of
 * this file — rename a field and only this file changes.
 *
 * `selectVisibleOrders` derives the filtered list rather than storing it. Derived data in the
 * store is data that can go stale; see also useMemo on the customer side, which is the same idea
 * without a store.
 * ========================================================================== */

export const selectOrdersState = (state: { orders: OrdersState }) => state.orders;

export function selectVisibleOrders(state: { orders: OrdersState }): Order[] {
  const { items, statusFilter } = state.orders;
  if (statusFilter.length === 0) return items;
  return items.filter((order) => statusFilter.includes(order.status));
}
