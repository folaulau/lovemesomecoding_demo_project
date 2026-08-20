import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { HumanisePipe, MoneyPipe } from '../../core/money.pipe';
import { Spinner } from '../../shared/spinner/spinner';
import type { Order, OrderStatus, Page } from '../../core/models';

/** Bootstrap contextual colours, keyed by status. `Record` makes a missing case a build error. */
export const STATUS_VARIANT: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'warning',
  PAID: 'primary',
  PREPARING: 'info',
  COMPLETED: 'success',
  CANCELLED: 'secondary',
};

@Component({
  selector: 'app-orders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, MoneyPipe, HumanisePipe, Spinner],
  templateUrl: './orders.html',
})
export class Orders {
  private readonly auth = inject(AuthService);
  readonly user = this.auth.user;

  /*
   * The bearer token is attached by the interceptor, so this endpoint being private changes
   * nothing about how it is called. That is the payoff of putting auth in an interceptor rather
   * than in an `auth: true` flag at every call site.
   */
  private readonly resource = httpResource<Page<Order>>(() => '/api/orders/mine?page=0&size=20');

  // `hasValue()` first: reading `value()` in an error state throws. See MenuService for the
  // full note — it is the one sharp edge on httpResource.
  readonly orders = computed(() => (this.resource.hasValue() ? this.resource.value().content : []));
  readonly loading = this.resource.isLoading;
  readonly error = computed(() => (this.resource.error() as Error | undefined)?.message ?? null);

  variant(status: OrderStatus): string {
    return STATUS_VARIANT[status];
  }

  shortId(id: string): string {
    return `${id.slice(0, 8)}…`;
  }
}
