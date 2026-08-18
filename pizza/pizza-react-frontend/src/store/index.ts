import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import { catalogReducer } from './catalogSlice';
import { ordersReducer } from './ordersSlice';
import { reportsReducer } from './reportsSlice';
import { usersReducer } from './usersSlice';

/* ==========================================================================
 * REDUX CONCEPT: the store — and why it exists in THIS app at all
 *
 * The customer-facing side of this app uses React Context and useReducer, and does so happily:
 * four small, independent, mostly-read contexts (auth, menu, cart, toasts).
 *
 * The admin side is a different problem. Several screens share a growing amount of state, the
 * updates are genuinely asynchronous, and the thing you most want while debugging a report that
 * disagrees with the orders table is a time-travelling log of every action. That is what Redux is
 * for, and it is why the split runs along that line rather than through the middle of a feature.
 *
 * NOTE the store is created here but only PROVIDED inside AdminLayout, which is a lazy route.
 * Redux therefore ships in the admin chunk and costs the 99% of visitors who never open /admin
 * exactly nothing. Putting <Provider> in main.tsx would have pulled it into the entry bundle.
 * ========================================================================== */

export const store = configureStore({
  reducer: {
    catalog: catalogReducer,
    orders: ordersReducer,
    reports: reportsReducer,
    users: usersReducer,
  },
  /*
   * configureStore already wires in redux-thunk, the Redux DevTools connection, and — in
   * development only — checks that scream if you mutate state outside a reducer or put a
   * non-serialisable value (a Date, a Promise, a class instance) in the store. Classic Redux
   * needed applyMiddleware and composeEnhancers by hand for the same result.
   */
});

/*
 * Types derived FROM the store rather than declared alongside it, so they can never drift out of
 * step with the reducers above. Add a slice and RootState grows automatically.
 */
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

/*
 * Pre-typed hooks. Components import these instead of the raw useSelector/useDispatch so that
 * state is typed without a generic at every call site, and so dispatching a thunk typechecks —
 * the plain Dispatch type does not know thunks are dispatchable.
 */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
