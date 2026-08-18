import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { adminApi } from '../lib/adminApi';
import type { ReportDashboard } from '../types';

/* ==========================================================================
 * REDUX CONCEPT: caching across unmounts
 *
 * This slice is the clearest argument for Redux on the admin side. The page it backs used to hold
 * the dashboard in useState, so switching to the Products tab and back threw the whole report away
 * and refetched it — a visible spinner every single time.
 *
 * Store state outlives the component, so `byRange` keeps what has already been fetched and the tab
 * comes back instantly. The data is still refreshed in the background, so "instant" never means
 * "stale forever".
 * ========================================================================== */

interface ReportsState {
  /** Keyed by the day-range, because 7/30/90 are three different reports, not one changing one. */
  byRange: Record<number, ReportDashboard>;
  days: number;
  loading: boolean;
  error: string | null;
}

const initialState: ReportsState = {
  byRange: {},
  days: 30,
  loading: false,
  error: null,
};

export const fetchDashboard = createAsyncThunk('reports/fetch', async (days: number) =>
  adminApi.dashboard(days),
);

const reportsSlice = createSlice({
  name: 'reports',
  initialState,
  reducers: {
    rangeChanged(state, action: PayloadAction<number>) {
      state.days = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboard.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDashboard.fulfilled, (state, action) => {
        state.loading = false;
        // action.meta.arg is the argument the thunk was dispatched with — here, the range. Without
        // it a slow 90-day response could land after the user switched to 7 and be filed wrongly.
        state.byRange[action.meta.arg] = action.payload;
      })
      .addCase(fetchDashboard.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Could not load reports.';
      });
  },
});

export const { rangeChanged } = reportsSlice.actions;
export const reportsReducer = reportsSlice.reducer;

// ------------------------------------------------------------------ selectors

export const selectDays = (state: { reports: ReportsState }) => state.reports.days;

/** The report for the CURRENTLY selected range, or undefined if it has not arrived yet. */
export const selectCurrentReport = (state: {
  reports: ReportsState;
}): ReportDashboard | undefined => state.reports.byRange[state.reports.days];

export const selectReportsLoading = (state: { reports: ReportsState }) => state.reports.loading;
export const selectReportsError = (state: { reports: ReportsState }) => state.reports.error;
