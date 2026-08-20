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
import type { ReportDashboard } from '../../core/models';

/* ==========================================================================
 * The clearest argument for a store on the admin side
 *
 * The reports page used to hold its dashboard in component state, so switching to the Products tab
 * and back threw the whole report away and refetched it — a visible spinner every single time.
 *
 * Store state outlives the component. `byRange` keeps what has already been fetched, so the tab
 * comes back instantly, and the data is still refreshed in the background so "instant" never means
 * "stale forever".
 *
 * That outliving is also why `provideState` for this feature sits on the ADMIN route rather than
 * on each page: the state has to survive the component that reads it, not the section.
 * ========================================================================== */
export const ReportsActions = createActionGroup({
  source: 'Admin Reports',
  events: {
    Load: props<{ days: number }>(),
    // `days` is echoed back deliberately — see the reducer.
    'Load Success': props<{ days: number; report: ReportDashboard }>(),
    'Load Failure': props<{ failure: ApiFailure }>(),
    'Range Changed': props<{ days: number }>(),
  },
});

interface ReportsState {
  /** Keyed by the day-range, because 7/30/90 are three different reports, not one changing one. */
  byRange: Record<number, ReportDashboard>;
  days: number;
  loading: boolean;
  error: string | null;
}

const initialState: ReportsState = { byRange: {}, days: 30, loading: false, error: null };

export const reportsFeature = createFeature({
  name: 'adminReports',
  reducer: createReducer(
    initialState,
    on(ReportsActions.load, (state): ReportsState => ({ ...state, loading: true, error: null })),

    /*
     * The response is filed under the range it was REQUESTED for, not the range currently selected.
     *
     * Without that, a slow 90-day response landing after the user switched to 7 would be filed as
     * the 7-day report and shown as if it were. Filing by request turns an out-of-order response
     * from a race into a non-event: it lands in the right slot and simply is not the one on screen.
     * The React app gets the same guarantee from `action.meta.arg`.
     */
    on(
      ReportsActions.loadSuccess,
      (state, { days, report }): ReportsState => ({
        ...state,
        loading: false,
        byRange: { ...state.byRange, [days]: report },
      }),
    ),
    on(
      ReportsActions.loadFailure,
      (state, { failure }): ReportsState => ({ ...state, loading: false, error: failure.message }),
    ),
    on(ReportsActions.rangeChanged, (state, { days }): ReportsState => ({ ...state, days })),
  ),

  extraSelectors: ({ selectByRange, selectDays }) => ({
    /** The report for the CURRENTLY selected range, or undefined if it has not arrived yet. */
    selectCurrentReport: createSelector(
      selectByRange,
      selectDays,
      (byRange, days): ReportDashboard | undefined => byRange[days],
    ),
  }),
});

export const reportsEffects = {
  load: createEffect(
    (actions$ = inject(Actions), api = inject(AdminApiService)) =>
      actions$.pipe(
        ofType(ReportsActions.load),
        switchMap(({ days }) =>
          api.dashboard(days).pipe(
            map((report) => ReportsActions.loadSuccess({ days, report })),
            catchError((err) =>
              of(
                ReportsActions.loadFailure({
                  failure: toApiFailure(err, 'Could not load reports'),
                }),
              ),
            ),
          ),
        ),
      ),
    { functional: true },
  ),

  /** Changing the range loads it. The component dispatches one action, not two. */
  loadOnRangeChange: createEffect(
    (actions$ = inject(Actions)) =>
      actions$.pipe(
        ofType(ReportsActions.rangeChanged),
        map(({ days }) => ReportsActions.load({ days })),
      ),
    { functional: true },
  ),
};
