import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { adminApi } from '../lib/adminApi';
import { toApiFailure } from './apiFailure';
import type {
  Crust,
  CrustWriteRequest,
  Product,
  ProductWriteRequest,
  Topping,
  ToppingWriteRequest,
  UUID,
} from '../types';

/* ==========================================================================
 * REDUX CONCEPT: slice boundaries follow the DOMAIN, not the screen
 *
 * Products, toppings and crusts get one slice between them, even though they have a tab each.
 * They are one thing — the menu — and they change together: adding a topping should be visible to
 * the product editor without either page knowing the other exists.
 *
 * Three near-identical slices was the alternative. It would have tripled the boilerplate below to
 * express that the catalogue is three unrelated things, which is not true.
 *
 * The repetition that IS here (three fetch/save/delete triples) is deliberate. A generic
 * `makeCrudSlice(name, api)` factory would collapse it into a third of the lines and make every
 * one of them harder to follow — the wrong trade for code that exists to be read.
 * ========================================================================== */

interface CatalogState {
  products: Product[];
  toppings: Topping[];
  crusts: Crust[];
  loading: boolean;
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

// ---------------------------------------------------------------- products

export const fetchProducts = createAsyncThunk('catalog/fetchProducts', async () =>
  adminApi.listProducts(),
);

/**
 * One thunk for create AND update.
 *
 * The screen treats them as one action — the same form, the same validation, the same success
 * message — and the only difference is whether an id exists yet. Splitting them here would push
 * that decision into the component for no gain.
 */
export const saveProduct = createAsyncThunk(
  'catalog/saveProduct',
  async ({ id, body }: { id?: UUID; body: ProductWriteRequest }, { rejectWithValue }) => {
    try {
      return id ? await adminApi.updateProduct(id, body) : await adminApi.createProduct(body);
    } catch (err) {
      return rejectWithValue(toApiFailure(err, 'Could not save that product'));
    }
  },
);

export const deactivateProduct = createAsyncThunk(
  'catalog/deactivateProduct',
  async (id: UUID, { rejectWithValue }) => {
    try {
      await adminApi.deactivateProduct(id);
      return id;
    } catch (err) {
      return rejectWithValue(toApiFailure(err, 'Could not deactivate that product'));
    }
  },
);

export const deleteProduct = createAsyncThunk(
  'catalog/deleteProduct',
  async (id: UUID, { rejectWithValue }) => {
    try {
      await adminApi.deleteProduct(id);
      return id;
    } catch (err) {
      return rejectWithValue(toApiFailure(err, 'Could not delete that product'));
    }
  },
);

// ---------------------------------------------------------------- toppings

export const fetchToppings = createAsyncThunk('catalog/fetchToppings', async () =>
  adminApi.listToppings(),
);

export const saveTopping = createAsyncThunk(
  'catalog/saveTopping',
  async ({ id, body }: { id?: UUID; body: ToppingWriteRequest }, { rejectWithValue }) => {
    try {
      return id ? await adminApi.updateTopping(id, body) : await adminApi.createTopping(body);
    } catch (err) {
      return rejectWithValue(toApiFailure(err, 'Could not save that topping'));
    }
  },
);

export const deleteTopping = createAsyncThunk(
  'catalog/deleteTopping',
  async (id: UUID, { rejectWithValue }) => {
    try {
      await adminApi.deleteTopping(id);
      return id;
    } catch (err) {
      return rejectWithValue(toApiFailure(err, 'Could not delete that topping'));
    }
  },
);

// ---------------------------------------------------------------- crusts

export const fetchCrusts = createAsyncThunk('catalog/fetchCrusts', async () =>
  adminApi.listCrusts(),
);

export const saveCrust = createAsyncThunk(
  'catalog/saveCrust',
  async ({ id, body }: { id?: UUID; body: CrustWriteRequest }, { rejectWithValue }) => {
    try {
      return id ? await adminApi.updateCrust(id, body) : await adminApi.createCrust(body);
    } catch (err) {
      return rejectWithValue(toApiFailure(err, 'Could not save that crust'));
    }
  },
);

export const deleteCrust = createAsyncThunk(
  'catalog/deleteCrust',
  async (id: UUID, { rejectWithValue }) => {
    try {
      await adminApi.deleteCrust(id);
      return id;
    } catch (err) {
      return rejectWithValue(toApiFailure(err, 'Could not delete that crust'));
    }
  },
);

const catalogSlice = createSlice({
  name: 'catalog',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.products = action.payload;
      })
      .addCase(fetchToppings.fulfilled, (state, action) => {
        state.toppings = action.payload;
      })
      .addCase(fetchCrusts.fulfilled, (state, action) => {
        state.crusts = action.payload;
      })

      // Mutations patch the list rather than refetching it — one round trip, and the table never
      // blanks out mid-edit.
      .addCase(saveProduct.fulfilled, (state, action) => {
        state.products = upsert(state.products, action.payload);
      })
      .addCase(saveTopping.fulfilled, (state, action) => {
        state.toppings = upsert(state.toppings, action.payload);
      })
      .addCase(saveCrust.fulfilled, (state, action) => {
        state.crusts = upsert(state.crusts, action.payload);
      })
      .addCase(deleteProduct.fulfilled, (state, action) => {
        state.products = state.products.filter((p) => p.id !== action.payload);
      })
      .addCase(deleteTopping.fulfilled, (state, action) => {
        state.toppings = state.toppings.filter((t) => t.id !== action.payload);
      })
      .addCase(deleteCrust.fulfilled, (state, action) => {
        state.crusts = state.crusts.filter((c) => c.id !== action.payload);
      })
      .addCase(deactivateProduct.fulfilled, (state, action) => {
        // The endpoint returns no body, so flip the flag locally rather than refetch the list.
        state.products = state.products.map((p) =>
          p.id === action.payload ? { ...p, active: false } : p,
        );
      })

      /*
       * REDUX CONCEPT: matchers.
       *
       * Rather than write pending/rejected cases for all nine thunks, match them by suffix.
       * `addMatcher` must come after every `addCase`.
       */
      .addMatcher(
        (action) => action.type.startsWith('catalog/') && action.type.endsWith('/pending'),
        (state) => {
          state.loading = true;
          state.error = null;
        },
      )
      .addMatcher(
        (action) => action.type.startsWith('catalog/') && action.type.endsWith('/fulfilled'),
        (state) => {
          state.loading = false;
        },
      )
      .addMatcher(
        (
          action,
        ): action is { type: string; payload?: unknown; error?: { message?: string } } =>
          action.type.startsWith('catalog/') && action.type.endsWith('/rejected'),
        (state, action) => {
          state.loading = false;

          /*
           * Only a failed FETCH becomes the page-level error.
           *
           * A failed save or delete is already reported where it happened — beside the offending
           * input in the modal, or in a toast — and the component learns about it through
           * `unwrap()`. Letting those also land here put the same "already exists" message in two
           * places at once: under the form field AND in a banner at the top of the page behind the
           * modal. Shared error state is convenient right up to the point where one failure has
           * more than one right place to be shown.
           */
          if (action.type.startsWith('catalog/fetch')) {
            const failure = action.payload as { message?: string } | undefined;
            state.error = failure?.message ?? action.error?.message ?? 'Something went wrong.';
          }
        },
      );
  },
});

export const catalogReducer = catalogSlice.reducer;

// ------------------------------------------------------------------ selectors

export const selectProducts = (state: { catalog: CatalogState }) => state.catalog.products;
export const selectToppings = (state: { catalog: CatalogState }) => state.catalog.toppings;
export const selectCrusts = (state: { catalog: CatalogState }) => state.catalog.crusts;
export const selectCatalogLoading = (state: { catalog: CatalogState }) => state.catalog.loading;
export const selectCatalogError = (state: { catalog: CatalogState }) => state.catalog.error;
