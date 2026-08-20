import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  provideRouter,
} from '@angular/router';
import { ConfirmsNavigation, confirmLeaveGuard } from './guards';

/* ==========================================================================
 * ANGULAR CONCEPT: testing a functional guard
 *
 * A functional guard is just a function, but it may call `inject()`, so it has to run inside an
 * injection context. `TestBed.runInInjectionContext` supplies one — that is the whole trick, and
 * it is the reason a guard cannot simply be called like an ordinary function in a test.
 *
 * The three snapshot arguments are unused by this guard, so they are cast rather than built. Faking
 * a full `ActivatedRouteSnapshot` for a guard that never reads it is effort spent making the test
 * harder to read.
 * ========================================================================== */
describe('confirmLeaveGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  function run(component: ConfirmsNavigation) {
    return TestBed.runInInjectionContext(() =>
      confirmLeaveGuard(
        component,
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
        {} as RouterStateSnapshot,
      ),
    );
  }

  it('lets the navigation through when the component has nothing to lose', () => {
    expect(run({ canDeactivate: () => true })).toBe(true);
  });

  it('blocks when the component says no', () => {
    expect(run({ canDeactivate: () => false })).toBe(false);
  });

  it('passes a promise straight through, so the router waits for the answer', async () => {
    // This is what lets Checkout ask in a modal instead of window.confirm: the guard hands the
    // router a promise and the router holds the navigation open until it settles.
    let resolve!: (leave: boolean) => void;
    const answer = new Promise<boolean>((r) => (resolve = r));

    const result = run({ canDeactivate: () => answer });
    expect(result).toBeInstanceOf(Promise);

    resolve(true);
    await expect(result).resolves.toBe(true);
  });
});
