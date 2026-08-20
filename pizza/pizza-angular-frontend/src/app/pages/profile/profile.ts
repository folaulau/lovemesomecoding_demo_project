import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { ProfileApiService } from '../../core/profile-api.service';
import { ToastService } from '../../core/toast.service';
import { ApiError, errorMessage } from '../../core/api-error';
import { Modal } from '../../shared/modal/modal';
import { Spinner } from '../../shared/spinner/spinner';
import { StripePaymentForm } from '../../shared/stripe-payment-form/stripe-payment-form';
import type { Address, AddressWriteRequest, PaymentMethod } from '../../core/models';

@Component({
  selector: 'app-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Modal, Spinner, StripePaymentForm],
  templateUrl: './profile.html',
})
export class Profile {
  private readonly auth = inject(AuthService);
  private readonly profileApi = inject(ProfileApiService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly user = this.auth.user;

  readonly addresses = signal<Address[]>([]);
  readonly methods = signal<PaymentMethod[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  /** null = modal closed. 'new' = creating. An Address = editing that one. */
  readonly editing = signal<Address | 'new' | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly fieldErrors = signal<Record<string, string>>({});

  /** The SetupIntent secret, once one has been opened. Its presence swaps in the card form. */
  readonly setupSecret = signal<string | null>(null);
  readonly cardError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    label: [''],
    recipientName: [''],
    phone: [''],
    line1: ['', Validators.required],
    line2: [''],
    city: ['', Validators.required],
    state: ['', Validators.required],
    postalCode: ['', [Validators.required, Validators.pattern(/^\d{5}$/)]],
    primary: [false],
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      // Two independent requests, so they run concurrently rather than one after the other.
      const [addresses, methods] = await Promise.all([
        firstValueFrom(this.profileApi.listAddresses()),
        firstValueFrom(this.profileApi.listPaymentMethods()),
      ]);
      this.addresses.set(addresses);
      this.methods.set(methods);
      this.error.set(null);
    } catch (err) {
      this.error.set(errorMessage(err, 'Could not load your profile.'));
    } finally {
      this.loading.set(false);
    }
  }

  /* -------------------------------------------------------------- addresses */

  openCreate(): void {
    this.form.reset({
      label: '',
      recipientName: '',
      phone: '',
      line1: '',
      line2: '',
      city: '',
      state: '',
      postalCode: '',
      primary: false,
    });
    this.fieldErrors.set({});
    this.formError.set(null);
    this.editing.set('new');
  }

  openEdit(address: Address): void {
    this.form.reset({
      label: address.label ?? '',
      recipientName: address.recipientName ?? '',
      phone: address.phone ?? '',
      line1: address.line1,
      line2: address.line2 ?? '',
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      primary: address.primary,
    });
    this.fieldErrors.set({});
    this.formError.set(null);
    this.editing.set(address);
  }

  async saveAddress(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.fieldErrors.set({});
    this.formError.set(null);

    const body = this.form.getRawValue() as AddressWriteRequest;
    const editing = this.editing();

    try {
      if (editing === 'new') {
        await firstValueFrom(this.profileApi.addAddress(body));
        this.toast.show('Address saved');
      } else if (editing) {
        await firstValueFrom(this.profileApi.updateAddress(editing.id, body));
        this.toast.show('Address updated');
      }
      this.editing.set(null);
      await this.load();
    } catch (err) {
      // The API returns field-level failures; surface them next to the inputs rather than dumping
      // one generic message at the top of the form.
      if (err instanceof ApiError) {
        this.fieldErrors.set(err.fieldErrors());
        this.formError.set(err.message);
      } else {
        this.formError.set('Could not save that address.');
      }
    } finally {
      this.saving.set(false);
    }
  }

  async makeAddressPrimary(address: Address): Promise<void> {
    await firstValueFrom(this.profileApi.makeAddressPrimary(address.id));
    this.toast.show('Primary address updated');
    await this.load();
  }

  async deleteAddress(address: Address): Promise<void> {
    await firstValueFrom(this.profileApi.deleteAddress(address.id));
    this.toast.show('Address removed', 'danger');
    await this.load();
  }

  describe(address: Address): string {
    const line2 = address.line2 ? `, ${address.line2}` : '';
    return `${address.line1}${line2}, ${address.city}, ${address.state} ${address.postalCode}`;
  }

  invalid(control: 'line1' | 'city' | 'state' | 'postalCode'): boolean {
    const field = this.form.controls[control];
    return (field.touched && field.invalid) || this.fieldError(control) !== null;
  }

  /** A server-side field error, if the API reported one for this input. */
  fieldError(control: string): string | null {
    return this.fieldErrors()[control] ?? null;
  }

  /* ---------------------------------------------------------- payment methods */

  /**
   * Opens a Stripe SetupIntent so a card can be collected WITHOUT being charged.
   *
   * The card itself is typed into Stripe's iframe and goes straight to Stripe; our code only ever
   * sees the resulting `pm_…` token, which is the only thing sent to our API.
   */
  async startAddingCard(): Promise<void> {
    this.cardError.set(null);
    try {
      const { clientSecret } = await firstValueFrom(this.profileApi.createSetupIntent());
      this.setupSecret.set(clientSecret);
    } catch (err) {
      this.cardError.set(errorMessage(err, 'Could not start card setup.'));
    }
  }

  async cardCollected(paymentMethodId: string | null): Promise<void> {
    if (!paymentMethodId) return;

    try {
      await firstValueFrom(this.profileApi.addPaymentMethod(paymentMethodId));
      this.toast.show('Card saved');
      this.setupSecret.set(null);
      await this.load();
    } catch (err) {
      this.cardError.set(errorMessage(err, 'Could not save that card.'));
    }
  }

  async makeCardPrimary(method: PaymentMethod): Promise<void> {
    await firstValueFrom(this.profileApi.makePaymentMethodPrimary(method.id));
    this.toast.show('Primary card updated');
    await this.load();
  }

  async deleteCard(method: PaymentMethod): Promise<void> {
    await firstValueFrom(this.profileApi.deletePaymentMethod(method.id));
    this.toast.show('Card removed', 'danger');
    await this.load();
  }

  expiry(method: PaymentMethod): string {
    return `${String(method.expMonth).padStart(2, '0')}/${method.expYear}`;
  }
}
