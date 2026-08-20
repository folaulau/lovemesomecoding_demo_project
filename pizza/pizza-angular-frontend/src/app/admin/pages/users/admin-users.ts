import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Actions } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { AuthService } from '../../../core/auth.service';
import { ToastService } from '../../../core/toast.service';
import { Spinner } from '../../../shared/spinner/spinner';
import { UsersActions, usersFeature } from '../../store/users.store';
import { outcome } from '../../store/outcome';
import type { AdminUser } from '../../../core/models';

/**
 * The users tab.
 *
 * <p>Note the deliberate MIX: the user list comes from NgRx (admin data, shared, mutated) while
 * `AuthService` and `ToastService` are the same signal services the customer pages use. Identity
 * and toasts belong to the whole app, so moving them into an admin-only store would put them out
 * of reach of every screen that also needs them. "NgRx for admin" is about admin DATA, not about
 * banning services.
 */
@Component({
  selector: 'app-admin-users',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, Spinner],
  templateUrl: './admin-users.html',
})
export class AdminUsers {
  private readonly store = inject(Store);
  private readonly actions$ = inject(Actions);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly users = this.store.selectSignal(usersFeature.selectItems);
  readonly loading = this.store.selectSignal(usersFeature.selectLoading);
  readonly error = this.store.selectSignal(usersFeature.selectError);

  constructor() {
    this.store.dispatch(UsersActions.load());
  }

  /**
   * An admin cannot demote or delete themselves — with one admin, either would lock them out of
   * their own back office. The server refuses it too; this just avoids offering a button that will
   * always fail.
   */
  isSelf(row: AdminUser): boolean {
    return row.email.toLowerCase() === this.auth.user()?.email.toLowerCase();
  }

  async changeRole(target: AdminUser, role: string): Promise<void> {
    const done = outcome(
      this.actions$,
      UsersActions.changeRoleSuccess,
      UsersActions.changeRoleFailure,
    );
    this.store.dispatch(
      UsersActions.changeRole({ id: target.id, role: role as 'CUSTOMER' | 'ADMIN' }),
    );
    const result = await done;

    if (!result.ok) {
      // The server's own explanation, shown verbatim — refusals here are deliberate ("you cannot
      // demote yourself") and the reason is the useful part.
      this.toast.show(result.failure.message, 'danger');
      return;
    }

    this.toast.show(`${target.email} is now ${role.toLowerCase()}`);
  }

  async remove(target: AdminUser): Promise<void> {
    const done = outcome(this.actions$, UsersActions.deleteSuccess, UsersActions.deleteFailure);
    this.store.dispatch(UsersActions.delete({ id: target.id }));
    const result = await done;

    if (!result.ok) {
      this.toast.show(result.failure.message, 'danger');
      return;
    }

    this.toast.show(`${target.email} deleted`, 'danger');
  }
}
