import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { createActionGroup, createFeature, createReducer, emptyProps, on, props } from '@ngrx/store';
import { catchError, map, of, switchMap } from 'rxjs';
import { AdminApiService } from '../../core/admin-api.service';
import { toApiFailure, type ApiFailure } from './api-failure';
import type { AdminUser, UUID } from '../../core/models';

/* ==========================================================================
 * Why the failure payload carries the SERVER's message verbatim
 *
 * The API refuses some role changes on purpose — an admin may not demote or delete themselves,
 * because with one admin either would lock them out of their own back office. Its explanation is
 * the useful part, so it is shown as written rather than replaced with a generic "something went
 * wrong".
 *
 * That is the same reason the React app reaches for `rejectWithValue` in its users slice.
 * ========================================================================== */
export const UsersActions = createActionGroup({
  source: 'Admin Users',
  events: {
    Load: emptyProps(),
    'Load Success': props<{ users: AdminUser[] }>(),
    'Load Failure': props<{ failure: ApiFailure }>(),

    'Change Role': props<{ id: UUID; role: 'CUSTOMER' | 'ADMIN' }>(),
    'Change Role Success': props<{ user: AdminUser }>(),
    'Change Role Failure': props<{ failure: ApiFailure }>(),

    Delete: props<{ id: UUID }>(),
    'Delete Success': props<{ id: UUID }>(),
    'Delete Failure': props<{ failure: ApiFailure }>(),
  },
});

interface UsersState {
  items: AdminUser[];
  loading: boolean;
  error: string | null;
}

const initialState: UsersState = { items: [], loading: false, error: null };

export const usersFeature = createFeature({
  name: 'adminUsers',
  reducer: createReducer(
    initialState,
    on(UsersActions.load, (state): UsersState => ({ ...state, loading: true, error: null })),
    on(
      UsersActions.loadSuccess,
      (state, { users }): UsersState => ({ ...state, loading: false, items: users }),
    ),
    on(
      UsersActions.loadFailure,
      (state, { failure }): UsersState => ({ ...state, loading: false, error: failure.message }),
    ),

    // Both mutations patch the list in place instead of refetching it. One round trip instead of
    // two, and the table never blanks out mid-update.
    on(
      UsersActions.changeRoleSuccess,
      (state, { user }): UsersState => ({
        ...state,
        items: state.items.map((existing) => (existing.id === user.id ? user : existing)),
      }),
    ),
    on(
      UsersActions.deleteSuccess,
      (state, { id }): UsersState => ({
        ...state,
        items: state.items.filter((u) => u.id !== id),
      }),
    ),
  ),
});

export const usersEffects = {
  load: createEffect(
    (actions$ = inject(Actions), api = inject(AdminApiService)) =>
      actions$.pipe(
        ofType(UsersActions.load),
        switchMap(() =>
          api.listUsers().pipe(
            map((users) => UsersActions.loadSuccess({ users })),
            catchError((err) =>
              of(UsersActions.loadFailure({ failure: toApiFailure(err, 'Could not load users') })),
            ),
          ),
        ),
      ),
    { functional: true },
  ),

  changeRole: createEffect(
    (actions$ = inject(Actions), api = inject(AdminApiService)) =>
      actions$.pipe(
        ofType(UsersActions.changeRole),
        switchMap(({ id, role }) =>
          api.changeUserRole(id, role).pipe(
            map((user) => UsersActions.changeRoleSuccess({ user })),
            catchError((err) =>
              of(
                UsersActions.changeRoleFailure({
                  failure: toApiFailure(err, 'Could not change that role'),
                }),
              ),
            ),
          ),
        ),
      ),
    { functional: true },
  ),

  remove: createEffect(
    (actions$ = inject(Actions), api = inject(AdminApiService)) =>
      actions$.pipe(
        ofType(UsersActions.delete),
        switchMap(({ id }) =>
          api.deleteUser(id).pipe(
            map(() => UsersActions.deleteSuccess({ id })),
            catchError((err) =>
              of(
                UsersActions.deleteFailure({
                  failure: toApiFailure(err, 'Could not delete that user'),
                }),
              ),
            ),
          ),
        ),
      ),
    { functional: true },
  ),
};
