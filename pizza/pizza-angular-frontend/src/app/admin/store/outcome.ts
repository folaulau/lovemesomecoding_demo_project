import { Actions } from '@ngrx/effects';
import { filter, firstValueFrom, map, take } from 'rxjs';
import type { ApiFailure } from './api-failure';

export type Outcome = { ok: true } | { ok: false; failure: ApiFailure };

/* ==========================================================================
 * NGRX CONCEPT: how a component learns whether a dispatch worked
 *
 * Redux Toolkit answers this with `.unwrap()` — `await dispatch(thunk()).unwrap()` re-throws the
 * rejection so a normal try/catch works. (Forgetting it is the trap the React app documents: a
 * bare `dispatch` RESOLVES even when the thunk rejects, so every failure gets reported to the user
 * as a success.)
 *
 * NgRx has no `.unwrap()`, because a thunk is not what ran — an EFFECT did, and it announced the
 * result by dispatching another action. So the component listens for that announcement. The
 * `Actions` stream is every dispatched action, and `ofType` filters it to the two that end this
 * particular request.
 *
 * ⚠️ ORDER MATTERS. `firstValueFrom` subscribes the moment it is called, so this must be called
 * BEFORE the dispatch:
 *
 *     const done = outcome(actions$, saveSuccess, saveFailure);   // subscribe first
 *     store.dispatch(save({ body }));                             // then dispatch
 *     const result = await done;
 *
 * Dispatch first and a fast synchronous effect can emit before anyone is listening, and the await
 * never resolves. That is this pattern's version of the `.unwrap()` trap.
 * ========================================================================== */
export function outcome(
  actions$: Actions,
  success: { type: string },
  failure: { type: string },
): Promise<Outcome> {
  return firstValueFrom(
    actions$.pipe(
      // Matching on `.type` rather than passing the creators to `ofType` keeps this callable with
      // any pair of actions, whatever payloads they carry.
      filter((action) => action.type === success.type || action.type === failure.type),
      take(1),
      map((action): Outcome =>
        action.type === success.type
          ? { ok: true }
          : { ok: false, failure: (action as unknown as { failure: ApiFailure }).failure },
      ),
    ),
  );
}
