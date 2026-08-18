import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { adminApi } from '../lib/adminApi';
import { toApiFailure } from './apiFailure';
import type { AdminUser, UUID } from '../types';

/* ==========================================================================
 * REDUX CONCEPT: rejectWithValue
 *
 * A thunk that throws lands in `rejected` with `action.error`, which is a serialised copy of the
 * Error — good enough for a message, but it loses anything custom, including our ApiError's field
 * errors. `rejectWithValue` sends a value YOU choose to the rejected case instead.
 *
 * That matters here because the server refuses some role changes on purpose (an admin may not
 * demote or delete themselves) and its explanation is worth showing verbatim rather than replacing
 * with a generic "something went wrong".
 * ========================================================================== */

interface UsersState {
  items: AdminUser[];
  loading: boolean;
  error: string | null;
}

const initialState: UsersState = { items: [], loading: false, error: null };

export const fetchUsers = createAsyncThunk('users/fetch', async () => adminApi.listUsers());

export const changeUserRole = createAsyncThunk(
  'users/changeRole',
  async ({ id, role }: { id: UUID; role: 'CUSTOMER' | 'ADMIN' }, { rejectWithValue }) => {
    try {
      return await adminApi.changeUserRole(id, role);
    } catch (err) {
      return rejectWithValue(toApiFailure(err, 'Could not change that role'));
    }
  },
);

export const deleteUser = createAsyncThunk(
  'users/delete',
  async (id: UUID, { rejectWithValue }) => {
    try {
      await adminApi.deleteUser(id);
      return id;
    } catch (err) {
      return rejectWithValue(toApiFailure(err, 'Could not delete that user'));
    }
  },
);

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Could not load users.';
      })
      /*
       * Both mutations patch the list in place instead of refetching it. One round trip instead of
       * two, and the table never blanks out mid-update.
       */
      .addCase(changeUserRole.fulfilled, (state, action) => {
        state.items = state.items.map((u) => (u.id === action.payload.id ? action.payload : u));
      })
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.items = state.items.filter((u) => u.id !== action.payload);
      });
  },
});

export const usersReducer = usersSlice.reducer;

// ------------------------------------------------------------------ selectors

export const selectUsers = (state: { users: UsersState }) => state.users.items;
export const selectUsersLoading = (state: { users: UsersState }) => state.users.loading;
export const selectUsersError = (state: { users: UsersState }) => state.users.error;
