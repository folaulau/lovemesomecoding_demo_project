import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Site footer, including a collapsed panel of demo sign-ins.
 *
 * <p>Putting credentials on the page is normally indefensible. It is fine HERE, and only here,
 * because these two accounts are seeded fixtures in a throwaway demo database — the same pair the
 * login page already prints. Nothing they unlock exists outside this machine.
 *
 * <p>If this app ever pointed at real data, this block is the first thing to delete.
 *
 * <p>Built on native `<details>`/`<summary>` rather than a JS accordion: the browser gives the
 * open/close behaviour, keyboard support and screen-reader semantics for free. Worth noticing that
 * this component has no logic at all — the framework column of the diff is empty, because the
 * platform already does the work.
 */
@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="bg-pizza-black text-white-50 mt-5 py-4">
      <div class="container">
        <details class="demo-logins mb-3">
          <summary>Demo sign-ins</summary>

          <div class="mt-2 small">
            <div class="mb-2">
              <span class="badge bg-primary me-2">admin</span>
              <code>admin&#64;pizza.test</code> / <code>admin123</code>
              <span class="d-block text-white-50">
                Unlocks the Admin tab — reports, menu management and orders.
              </span>
            </div>

            <div>
              <span class="badge bg-secondary me-2">customer</span>
              <code>customer&#64;pizza.test</code> / <code>pizza123</code>
              <span class="d-block text-white-50">
                Saved addresses, order history and a saved card.
              </span>
            </div>

            <div class="mt-2 text-white-50">
              You can also order without signing in at all — guest checkout works end to end.
            </div>
          </div>
        </details>

        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 small">
          <span>PizzaHub — the Angular build of the demo app for lovemesomecoding.com</span>
          <span>Not a real restaurant. Please do not expect a pizza.</span>
        </div>
      </div>
    </footer>
  `,
})
export class AppFooter {}
