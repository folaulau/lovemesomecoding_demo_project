import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { Stripe, StripeElements } from '@stripe/stripe-js';
import { MoneyPipe } from '../../core/money.pipe';
import { stripeAppearance, stripePromise } from '../../core/stripe';
import { Spinner } from '../spinner/spinner';

/**
 * The card form — used both to PAY for an order and to SAVE a card for later.
 *
 * <p>The React app has two of these: `StripePaymentForm` for checkout and an `AddCardForm` inside
 * the profile page. They differ only in which Stripe call they make, so this is one component with
 * a `mode` input. The React split is not wrong; it is what `<Elements>` being a provider component
 * nudges you towards.
 *
 * <p>THE CARD NUMBER NEVER TOUCHES OUR CODE. `elements.create('payment')` mounts an iframe hosted
 * by Stripe, so the details go straight from the customer's browser to Stripe. That is what keeps
 * this app out of PCI scope, and it is why nothing here reads a value out of that element.
 *
 * <p>Without `@stripe/react-stripe-js` the plumbing is explicit: load Stripe.js, create an
 * `Elements` group against the client secret, mount it into a real DOM node, confirm, tear down.
 * The React wrapper does all five — this is what it is doing.
 */
@Component({
  selector: 'app-stripe-payment-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoneyPipe, Spinner],
  template: `
    <form (submit)="submit($event)">
      <!-- Stripe mounts its iframe into this node. It must exist before mount() is called. -->
      <div #elementHost class="stripe-element-host"></div>

      @if (!ready()) {
        <app-spinner label="Loading the card form…" [inline]="true" />
      }

      @if (error(); as message) {
        <div class="alert alert-danger mt-3 mb-0">{{ message }}</div>
      }

      <div class="d-flex gap-2 mt-3">
        <button
          type="submit"
          class="btn btn-primary"
          [class.btn-lg]="mode() === 'payment'"
          [class.w-100]="mode() === 'payment'"
          [disabled]="!ready() || submitting()"
        >
          @if (submitting()) {
            <span class="spinner-border spinner-border-sm me-2"></span>
            {{ mode() === 'payment' ? 'Processing…' : 'Saving…' }}
          } @else if (mode() === 'payment') {
            Pay {{ total() | money }}
          } @else {
            Save card
          }
        </button>

        @if (mode() === 'setup') {
          <button
            type="button"
            class="btn btn-outline-secondary"
            [disabled]="submitting()"
            (click)="cancelled.emit()"
          >
            Cancel
          </button>
        }
      </div>

      <p class="small text-muted mt-2 mb-0">
        Test mode — use card <code>4242 4242 4242 4242</code>, any future expiry, any CVC.
      </p>
    </form>
  `,
})
export class StripePaymentForm {
  private readonly destroyRef = inject(DestroyRef);

  /** The PaymentIntent or SetupIntent secret the server opened. */
  readonly clientSecret = input.required<string>();
  /** `payment` charges the card; `setup` stores it without charging. */
  readonly mode = input<'payment' | 'setup'>('payment');
  readonly total = input(0);
  /** Where Stripe should return to if the card needs a redirect (3D Secure, a bank page). */
  readonly returnPath = input('/checkout');

  /** Emits the `pm_…` token in `setup` mode; emits nothing in `payment` mode. */
  readonly succeeded = output<string | null>();
  readonly cancelled = output<void>();

  readonly ready = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('elementHost');

  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;
  private mountedSecret: string | null = null;

  constructor() {
    /*
     * `afterRenderEffect` runs AFTER the DOM has been written, which is the earliest point at which
     * `#elementHost` exists to mount into. A plain `effect()` would run too early and Stripe would
     * be handed a node that is not in the document yet.
     *
     * Guarding on `mountedSecret` keeps this idempotent: the effect may run again for reasons that
     * have nothing to do with the secret, and mounting Stripe's element twice into the same node
     * throws.
     */
    afterRenderEffect(() => {
      const secret = this.clientSecret();
      const host = this.host().nativeElement;
      if (!secret || secret === this.mountedSecret) return;

      this.mountedSecret = secret;
      void this.mount(secret, host);
    });

    this.destroyRef.onDestroy(() => this.elements?.getElement('payment')?.destroy());
  }

  private async mount(clientSecret: string, host: HTMLElement): Promise<void> {
    this.stripe = await stripePromise;

    if (!this.stripe) {
      this.error.set('Stripe is not configured — no publishable key was built into this app.');
      return;
    }

    this.elements = this.stripe.elements({ clientSecret, appearance: stripeAppearance });
    this.elements.create('payment').mount(host);
    this.ready.set(true);
  }

  async submit(event: Event): Promise<void> {
    event.preventDefault();

    const stripe = this.stripe;
    const elements = this.elements;
    // Both are null until Stripe.js has finished loading.
    if (!stripe || !elements) return;

    this.submitting.set(true);
    this.error.set(null);

    /*
     * `redirect: 'if_required'` keeps the customer inside our app for ordinary card payments, and
     * only redirects when the payment method genuinely demands it — 3D Secure, or a bank redirect.
     * `return_url` is where Stripe sends them back to in that case.
     */
    const confirmParams = { return_url: `${window.location.origin}${this.returnPath()}` };

    const result =
      this.mode() === 'payment'
        ? await stripe.confirmPayment({ elements, redirect: 'if_required', confirmParams })
        : await stripe.confirmSetup({ elements, redirect: 'if_required', confirmParams });

    if (result.error) {
      /*
       * card_error and validation_error are safe to show; anything else gets a generic message,
       * because the detail can leak information about the payment infrastructure.
       */
      this.error.set(
        result.error.type === 'card_error' || result.error.type === 'validation_error'
          ? (result.error.message ?? 'Your card was declined.')
          : 'Something went wrong taking the payment. Please try again.',
      );
      this.submitting.set(false);
      return;
    }

    /*
     * Success here means STRIPE accepted it. Our order stays PENDING_PAYMENT until the backend
     * hears about it — via the webhook, or via the confirmation page polling /payment-status. An
     * order is never marked paid from the browser: anyone can call our API.
     */
    if (this.mode() === 'setup') {
      const paymentMethodId = 'setupIntent' in result ? result.setupIntent?.payment_method : null;

      if (typeof paymentMethodId !== 'string') {
        this.error.set('Stripe did not return a payment method.');
        this.submitting.set(false);
        return;
      }

      this.succeeded.emit(paymentMethodId);
      this.submitting.set(false);
      return;
    }

    this.succeeded.emit(null);
  }
}
