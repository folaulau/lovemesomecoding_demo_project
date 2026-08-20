import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-register',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.html',
})
export class Register {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Honour the destination a guard stashed, exactly as the login page does. */
  readonly returnUrl = input('/');

  readonly error = this.auth.error;
  readonly loading = this.auth.loading;

  readonly fullName = signal('');
  readonly email = signal('');
  readonly password = signal('');

  async submit(): Promise<void> {
    try {
      /*
       * Note what is NOT sent: a role. Registration always creates a CUSTOMER, and the server
       * decides that — a role arriving in a request body would be an instant privilege escalation.
       */
      await this.auth.register(this.email(), this.password(), this.fullName());
      await this.router.navigateByUrl(this.returnUrl(), { replaceUrl: true });
    } catch {
      // The message is already surfaced through AuthService.
    }
  }
}
