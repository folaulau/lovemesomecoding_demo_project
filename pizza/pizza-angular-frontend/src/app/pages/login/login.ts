import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

/* ==========================================================================
 * ANGULAR CONCEPT: template-driven forms with `[(ngModel)]`
 *
 * Two of the app's forms are template-driven (this and Register) and the rest are reactive. That
 * is deliberate, not inconsistency: template-driven is the right size for two fields with no
 * cross-field rules, and reactive earns its keep the moment a form has validation to express,
 * values to patch in from a server, or errors to attach per field. Both are shown so the choice is
 * visible.
 *
 * `[(ngModel)]` is Angular's two-way binding, and it has no React equivalent because React does
 * not have one — `value={x} onChange={e => setX(e.target.value)}` is written out at every input
 * over there. The banana-in-a-box is sugar for exactly that pair: `[ngModel]` down, `(ngModelChange)`
 * up. It is still one-way data flow underneath.
 * ========================================================================== */
@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /**
   * Where to go after a successful sign-in.
   *
   * The guard puts the attempted URL in the query string, so a user bounced off /admin lands back
   * on /admin rather than on the home page.
   */
  readonly returnUrl = input('/');

  readonly error = this.auth.error;
  readonly loading = this.auth.loading;

  // Prefilled with the demo customer — this is a throwaway local fixture database.
  readonly email = signal('customer@pizza.test');
  readonly password = signal('pizza123');

  async submit(): Promise<void> {
    try {
      await this.auth.login(this.email(), this.password());
      // `replaceUrl` swaps the history entry instead of adding one, so Back after signing in does
      // not bounce the user straight back to the login form.
      await this.router.navigateByUrl(this.returnUrl(), { replaceUrl: true });
    } catch {
      // The message is already surfaced through AuthService; nothing to do here.
    }
  }
}
