import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Actions } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { ToastService } from '../../../core/toast.service';
import { HumanisePipe, MoneyPipe } from '../../../core/money.pipe';
import { Spinner } from '../../../shared/spinner/spinner';
import { OrdersActions, ordersFeature } from '../../store/orders.store';
import { outcome } from '../../store/outcome';
import { STATUS_VARIANT } from '../../../pages/orders/orders';
import type { Order, OrderStatus } from '../../../core/models';

const STATUSES: OrderStatus[] = ['PENDING_PAYMENT', 'PAID', 'PREPARING', 'COMPLETED', 'CANCELLED'];

@Component({
  selector: 'app-admin-orders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, MoneyPipe, HumanisePipe, Spinner],
  templateUrl: './admin-orders.html',
})
export class AdminOrders {
  private readonly store = inject(Store);
  private readonly actions$ = inject(Actions);
  private readonly toast = inject(ToastService);

  readonly statuses = STATUSES;

  /*
   * Each of these subscribes to ONE slice of state. A component re-renders when the slice it
   * selected changes and not when an unrelated one does — the same guarantee `useSelector` gives,
   * arrived at through signals rather than a subscription.
   *
   * Compare the six pieces of component state this replaced in an earlier draft: the same data,
   * scattered across the component and thrown away the moment it was destroyed.
   */
  readonly orders = this.store.selectSignal(ordersFeature.selectVisibleOrders);
  readonly page = this.store.selectSignal(ordersFeature.selectPage);
  readonly totalPages = this.store.selectSignal(ordersFeature.selectTotalPages);
  readonly loading = this.store.selectSignal(ordersFeature.selectLoading);
  readonly error = this.store.selectSignal(ordersFeature.selectError);

  constructor() {
    this.store.dispatch(OrdersActions.load({ page: 0 }));
  }

  variant(status: OrderStatus): string {
    return STATUS_VARIANT[status];
  }

  shortId(id: string): string {
    return `${id.slice(0, 8)}…`;
  }

  goToPage(page: number): void {
    // One action. An effect turns it into a load — see orders.store.ts.
    this.store.dispatch(OrdersActions.pageChanged({ page }));
  }

  async changeStatus(order: Order, status: string): Promise<void> {
    const done = outcome(
      this.actions$,
      OrdersActions.changeStatusSuccess,
      OrdersActions.changeStatusFailure,
    );
    this.store.dispatch(OrdersActions.changeStatus({ id: order.id, status: status as OrderStatus }));
    const result = await done;

    if (!result.ok) {
      this.toast.show(result.failure.message, 'danger');
      return;
    }

    this.toast.show(`Order moved to ${status.replace('_', ' ').toLowerCase()}`);
  }
}
