import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { CartService } from '../../core/cart.service';
import { ProfileApiService } from '../../core/profile-api.service';
import { errorMessage } from '../../core/api-error';
import type { ConfirmsNavigation } from '../../core/guards';
import { lineTotal } from '../../core/money';
import { HumanisePipe, MoneyPipe } from '../../core/money.pipe';
import { Modal } from '../../shared/modal/modal';
import { StripePaymentForm } from '../../shared/stripe-payment-form/stripe-payment-form';
import type {
  Address,
  CartItem,
  OrderCreateRequest,
  OrderCreateResponse,
  OrderType,
} from '../../core/models';

/** "Type a fresh address" — a sentinel, so exactly one radio is selected at any time. */
const NEW_ADDRESS = 'NEW';

/**
 * Checkout, in two steps.
 *
 * <p>1. Collect contact/address and POST /api/orders. The server prices the cart from the database,
 * saves the order as PENDING_PAYMENT and opens a Stripe PaymentIntent, returning its clientSecret.
 *
 * <p>2. Mount Stripe Elements against that clientSecret and confirm the card.
 *
 * <p>The order has to exist before the payment form can render, because the PaymentIntent is what
 * the card form confirms. That ordering is why this is two steps rather than one big submit.
 *
 * <p>Note what is NOT sent in step 1: no prices. The server decides what the cart costs, and
 * ignores anything the browser claims — otherwise anyone could edit the request and buy a large
 * pizza for a cent.
 */
@Component({
  selector: 'app-checkout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, MoneyPipe, HumanisePipe, StripePaymentForm, Modal],
  templateUrl: './checkout.html',
})
export class Checkout implements ConfirmsNavigation {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly profileApi = inject(ProfileApiService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly NEW_ADDRESS = NEW_ADDRESS;

  readonly items = this.cart.items;
  readonly totals = this.cart.totals;
  readonly orderType = this.cart.orderType;
  readonly isAuthenticated = this.auth.isAuthenticated;

  /** Set once the order exists server-side; its presence is what advances us to step 2. */
  readonly created = signal<OrderCreateResponse | null>(null);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  /** Bootstrap only paints validation styling after a submit attempt. */
  readonly submitted = signal(false);

  readonly addresses = signal<Address[]>([]);
  readonly selectedAddressId = signal<string>(NEW_ADDRESS);

  readonly isDelivery = computed(() => this.orderType() === 'DELIVERY');
  /** Only ask for typed address fields when there is no saved address selected. */
  readonly usingNewAddress = computed(() => this.selectedAddressId() === NEW_ADDRESS);

  /* ==========================================================================
   * ANGULAR CONCEPT: a reactive form
   *
   * The login page is template-driven; this one is not. A reactive form is worth its extra
   * ceremony as soon as there are rules to express in TypeScript rather than in attributes: here,
   * the address fields are required ONLY when the order is a delivery AND no saved address is
   * selected, which is a rule about three things at once.
   *
   * React has no equivalent because it has no forms library — the same logic there is an `if` in
   * the submit handler plus per-field error state. Neither is better; Angular's version puts the
   * rule next to the field, which is where it stays true.
   * ========================================================================== */
  readonly form = this.fb.nonNullable.group({
    customerName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    addressLine1: [''],
    city: [''],
    state: [''],
    postalCode: ['', Validators.pattern(/^\d{5}$/)],
  });

  constructor() {
    // Prefill from the account, once the session has been restored.
    effect(() => {
      const user = this.auth.user();
      if (!user) return;
      this.form.patchValue({
        customerName: this.form.controls.customerName.value || (user.fullName ?? ''),
        email: this.form.controls.email.value || user.email,
      });
    });

    /*
     * Load the customer's saved addresses and preselect their PRIMARY one.
     * Guests skip this entirely — they have no account, so there is nothing to load.
     */
    effect(() => {
      if (!this.auth.isAuthenticated()) return;
      void this.loadAddresses();
    });

    /*
     * Keep the address validators in step with what is actually on screen. Without this, switching
     * to carryout would leave the street address required and the form permanently invalid — the
     * classic conditional-validation bug.
     */
    effect(() => {
      const required = this.isDelivery() && this.usingNewAddress();
      const { addressLine1, city, state, postalCode } = this.form.controls;

      for (const control of [addressLine1, city, state]) {
        control.setValidators(required ? [Validators.required] : []);
        control.updateValueAndValidity({ emitEvent: false });
      }

      postalCode.setValidators(
        required
          ? [Validators.required, Validators.pattern(/^\d{5}$/)]
          : [Validators.pattern(/^\d{5}$/)],
      );
      postalCode.updateValueAndValidity({ emitEvent: false });
    });
  }

  private async loadAddresses(): Promise<void> {
    try {
      const saved = await firstValueFrom(this.profileApi.listAddresses());
      this.addresses.set(saved);

      const primary = saved.find((a) => a.primary) ?? saved[0];
      if (primary) {
        this.selectedAddressId.set(primary.id);
        if (!this.form.controls.phone.value && primary.phone) {
          this.form.patchValue({ phone: primary.phone });
        }
      }
    } catch {
      // A profile that will not load must not block checkout — fall back to typing an address.
    }
  }

  setOrderType(orderType: OrderType): void {
    this.cart.setOrderType(orderType);
  }

  line(item: CartItem): number {
    return lineTotal(item);
  }

  /** Which figures the summary shows: the server's once an order exists, ours before that. */
  readonly money = computed(() => {
    const created = this.created();
    if (!created) return this.totals();

    const { subtotal, tax, deliveryFee, total } = created.order;
    return { subtotal, tax, deliveryFee, total, itemCount: 0 };
  });

  /** The address fields to send: from the chosen saved address, or from the form. */
  private addressFields(): Partial<OrderCreateRequest> {
    if (!this.usingNewAddress()) {
      const chosen = this.addresses().find((a) => a.id === this.selectedAddressId());
      if (chosen) {
        return {
          addressLine1: chosen.line1,
          addressLine2: chosen.line2 ?? undefined,
          city: chosen.city,
          state: chosen.state,
          postalCode: chosen.postalCode,
        };
      }
    }

    const { addressLine1, city, state, postalCode } = this.form.getRawValue();
    return { addressLine1, city, state, postalCode };
  }

  async createOrder(): Promise<void> {
    this.submitted.set(true);
    if (this.form.invalid) return;

    this.submitting.set(true);
    this.error.set(null);

    const { customerName, email, phone } = this.form.getRawValue();

    const payload: OrderCreateRequest = {
      orderType: this.orderType(),
      customerName,
      // Ignored by the server when a token is present — the account's email wins.
      guestEmail: email,
      phone: phone || undefined,
      ...(this.isDelivery() ? this.addressFields() : {}),
      items: this.items().map((item) => ({
        productId: item.productId,
        size: item.size,
        crustId: item.crustId,
        toppingIds: item.toppings.map((t) => t.id),
        quantity: item.quantity,
      })),
    };

    try {
      this.created.set(
        await firstValueFrom(this.api.post<OrderCreateResponse>('/api/orders', payload)),
      );
    } catch (err) {
      this.error.set(errorMessage(err, 'Could not reach the server. Is the API running on 8085?'));
    } finally {
      this.submitting.set(false);
    }
  }

  /* ==========================================================================
   * ANGULAR CONCEPT: answering a CanDeactivate guard
   *
   * Step 1 POSTs the order, so from that moment there is a real PENDING_PAYMENT row in the
   * database holding this cart. Walking away leaves it stranded — the customer thinks nothing
   * happened, and the order sits there unpaid. THAT is what is worth interrupting a navigation
   * for; a merely half-typed form is not, which is why this guards `created()` rather than
   * `form.dirty`.
   *
   * The guard in core/guards.ts calls this method. Returning a promise holds the navigation open
   * while the modal below asks, and `answerLeave` resolves it. No `window.confirm`: it cannot be
   * styled, cannot be driven through the UI by Playwright, and freezes the tab while it is up.
   * ========================================================================== */

  /** The pending guard answer. `null` means nothing is being asked. */
  private readonly leaveResolver = signal<((leave: boolean) => void) | null>(null);

  readonly askingToLeave = computed(() => this.leaveResolver() !== null);

  /** Set on the one navigation that is not an abandonment: the trip to the confirmation page. */
  private readonly paid = signal(false);

  canDeactivate(): boolean | Promise<boolean> {
    if (this.paid() || !this.created()) return true;
    return new Promise<boolean>((resolve) => this.leaveResolver.set(resolve));
  }

  answerLeave(leave: boolean): void {
    const resolve = this.leaveResolver();
    this.leaveResolver.set(null);
    resolve?.(leave);
  }

  /** Stripe accepted the card. The cart is done; the confirmation page confirms with the server. */
  async paymentSucceeded(): Promise<void> {
    const orderId = this.created()!.order.id;
    // Before navigating, not after: the guard runs during navigate(), so setting this afterwards
    // would pop the "abandon your order?" modal on the way to the success page.
    this.paid.set(true);
    this.cart.clear();
    await this.router.navigate(['/order-confirmation', orderId]);
  }

  invalid(control: 'customerName' | 'email' | 'addressLine1' | 'city' | 'state' | 'postalCode'): boolean {
    return this.submitted() && this.form.controls[control].invalid;
  }
}
