import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/api-error';
import { HumanisePipe, MoneyPipe } from '../../core/money.pipe';
import { Spinner } from '../../shared/spinner/spinner';
import { STATUS_VARIANT } from '../orders/orders';
import type { Order, OrderStatus } from '../../core/models';

/** How long to keep asking before giving up and telling the customer to check their email. */
const MAX_POLLS = 10;
const POLL_INTERVAL_MS = 2000;

@Component({
  selector: 'app-order-confirmation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MoneyPipe, HumanisePipe, Spinner],
  templateUrl: './order-confirmation.html',
})
export class OrderConfirmation implements OnInit {
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * The `:orderId` route segment, delivered as an input by `withComponentInputBinding()`.
   * This is `useParams()` without the hook, the injection, or the subscription.
   */
  readonly orderId = input.required<string>();

  readonly order = signal<Order | null>(null);
  readonly error = signal<string | null>(null);
  readonly settled = signal(false);

  private pollCount = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private cancelled = false;

  constructor() {
    /*
     * ANGULAR CONCEPT: DestroyRef
     *
     * Without this, the loop keeps firing requests forever after the user navigates away — the
     * exact bug React's `useEffect` cleanup function prevents. `DestroyRef.onDestroy` is that
     * cleanup, registered from anywhere rather than only from inside an effect.
     */
    this.destroyRef.onDestroy(() => {
      this.cancelled = true;
      clearTimeout(this.timer);
    });
  }

  /* ==========================================================================
   * ⚠️ ANGULAR GOTCHA: a required input is NOT readable from the constructor
   *
   * Polling started in the constructor and died immediately with
   * `NG0950: Input "orderId" is required but no value is available yet`. Inputs are assigned AFTER
   * the component is constructed, so a `input.required()` read that early throws — and it throws at
   * runtime, on the real page, with nothing at build time to warn you.
   *
   * `ngOnInit` runs once the inputs have been set, which is what it is for. (An `effect()` would
   * also work and would additionally re-poll if the id ever changed; here the id is fixed for the
   * lifetime of the route, so the lifecycle hook says what is meant with less machinery.)
   *
   * There is no React equivalent because there is no gap: props are an argument to the function,
   * so they exist before the body runs.
   * ========================================================================== */
  ngOnInit(): void {
    /*
     * Poll /payment-status until the order leaves PENDING_PAYMENT.
     *
     * Why poll at all, when there is a webhook? Because a webhook does not reach localhost unless
     * `stripe listen` is running, and even in production it can arrive seconds later than the
     * customer. That endpoint asks Stripe directly, so the page is correct either way.
     *
     * The browser is never the authority here: it only asks the server what the server believes.
     */
    void this.poll();
  }

  private async poll(): Promise<void> {
    try {
      const fresh = await firstValueFrom(
        this.api.get<Order>(`/api/orders/${this.orderId()}/payment-status`),
      );
      if (this.cancelled) return;

      this.order.set(fresh);
      this.error.set(null);

      if (fresh.status !== 'PENDING_PAYMENT') {
        this.settled.set(true);
        return;
      }

      this.pollCount += 1;
      if (this.pollCount >= MAX_POLLS) {
        this.settled.set(true);
        return;
      }

      this.timer = setTimeout(() => void this.poll(), POLL_INTERVAL_MS);
    } catch (err) {
      if (this.cancelled) return;
      this.error.set(errorMessage(err, 'Could not load the order.'));
      this.settled.set(true);
    }
  }

  variant(status: OrderStatus): string {
    return STATUS_VARIANT[status];
  }

  toppingNames(toppings: Array<{ toppingName: string }>): string {
    return toppings.map((t) => t.toppingName).join(', ');
  }
}
