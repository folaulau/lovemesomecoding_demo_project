import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Actions } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { MenuService } from '../../../core/menu.service';
import { ToastService } from '../../../core/toast.service';
import { MoneyPipe, humanise } from '../../../core/money.pipe';
import { Modal } from '../../../shared/modal/modal';
import { Spinner } from '../../../shared/spinner/spinner';
import { CatalogActions, catalogFeature } from '../../store/catalog.store';
import { outcome } from '../../store/outcome';
import type { Product, ProductWriteRequest, SizeName } from '../../../core/models';

const SIZES: SizeName[] = ['SMALL', 'MEDIUM', 'LARGE'];

@Component({
  selector: 'app-admin-products',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Modal, Spinner, MoneyPipe],
  templateUrl: './admin-products.html',
})
export class AdminProducts {
  private readonly store = inject(Store);
  private readonly actions$ = inject(Actions);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  /** The public menu is a signal service, not the store, so it has to be told the catalogue moved. */
  private readonly menu = inject(MenuService);

  readonly sizes = SIZES;

  /* ==========================================================================
   * NGRX CONCEPT: selectSignal
   *
   * `store.selectSignal(selector)` gives a signal rather than an observable, so the template reads
   * `products()` with no `| async` pipe and no subscription to clean up. It is the bridge that
   * makes an NgRx screen look like the signal-based customer screens next door.
   *
   * Only the LIST is store state. Which modal is open, what is typed into the form, and which
   * field is invalid all stay local: scratch state owned by one component, dead when it is
   * destroyed, useless to anyone else. Putting form keystrokes in a global store is the classic way
   * to make a store miserable. The rule is *shared* state goes in the store, not *all* state.
   * ========================================================================== */
  readonly products = this.store.selectSignal(catalogFeature.selectProducts);
  readonly loading = this.store.selectSignal(catalogFeature.selectLoading);
  readonly error = this.store.selectSignal(catalogFeature.selectError);

  /** null = modal closed. 'new' = creating. A Product = editing that one. */
  readonly editing = signal<Product | 'new' | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly fieldErrors = signal<Record<string, string>>({});

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    type: ['PIZZA' as Product['type']],
    active: [true],
    displayOrder: [0],
    /*
     * A FormArray, because the three size prices are a LIST of controls rather than three named
     * ones. React manages the same thing as an array in state plus an index-based setter; here the
     * array is part of the form, so validation and dirty-tracking come with it.
     */
    sizes: this.fb.array(
      SIZES.map((size) =>
        this.fb.nonNullable.group({
          size: [size],
          price: [0, [Validators.required, Validators.min(0.01)]],
        }),
      ),
    ),
  });

  get sizeControls(): FormArray {
    return this.form.controls.sizes;
  }

  constructor() {
    this.store.dispatch(CatalogActions.loadProducts());
  }

  label(value: string): string {
    return humanise(value);
  }

  priceFor(product: Product, size: SizeName): number {
    return product.sizes.find((s) => s.size === size)?.price ?? 0;
  }

  openCreate(): void {
    this.form.reset({
      name: '',
      description: '',
      type: 'PIZZA',
      active: true,
      displayOrder: 0,
      sizes: SIZES.map((size) => ({ size, price: 0 })),
    });
    this.fieldErrors.set({});
    this.formError.set(null);
    this.editing.set('new');
  }

  openEdit(product: Product): void {
    this.form.reset({
      name: product.name,
      description: product.description ?? '',
      type: product.type,
      active: product.active,
      displayOrder: product.displayOrder,
      sizes: SIZES.map((size) => ({ size, price: this.priceFor(product, size) })),
    });
    this.fieldErrors.set({});
    this.formError.set(null);
    this.editing.set(product);
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.fieldErrors.set({});
    this.formError.set(null);

    const editing = this.editing();
    const id = editing === 'new' || editing === null ? undefined : editing.id;
    const raw = this.form.getRawValue();

    const body: ProductWriteRequest = {
      name: raw.name,
      description: raw.description,
      type: raw.type,
      imageUrl: null,
      active: raw.active,
      displayOrder: raw.displayOrder,
      sizes: raw.sizes.map((s) => ({ size: s.size as SizeName, price: Number(s.price) })),
    };

    // Subscribe to the outcome BEFORE dispatching — see the note in outcome.ts.
    const done = outcome(
      this.actions$,
      CatalogActions.saveProductSuccess,
      CatalogActions.saveProductFailure,
    );
    this.store.dispatch(CatalogActions.saveProduct({ id, body }));
    const result = await done;

    this.saving.set(false);

    if (!result.ok) {
      // Field-level failures go next to the inputs rather than into one generic message. They
      // survived the trip through the store precisely because they were flattened into a plain
      // object before they ever became an action.
      this.fieldErrors.set(result.failure.fieldErrors);
      this.formError.set(result.failure.message);
      return;
    }

    this.toast.show(`${body.name} ${id ? 'updated' : 'created'}`);
    this.editing.set(null);
    this.menu.reload();
  }

  async deactivate(product: Product): Promise<void> {
    const done = outcome(
      this.actions$,
      CatalogActions.deactivateProductSuccess,
      CatalogActions.deactivateProductFailure,
    );
    this.store.dispatch(CatalogActions.deactivateProduct({ id: product.id }));
    const result = await done;

    if (!result.ok) {
      this.toast.show(result.failure.message, 'danger');
      return;
    }

    this.toast.show(`${product.name} hidden from the menu`, 'info');
    this.menu.reload();
  }

  async remove(product: Product): Promise<void> {
    const done = outcome(
      this.actions$,
      CatalogActions.deleteProductSuccess,
      CatalogActions.deleteProductFailure,
    );
    this.store.dispatch(CatalogActions.deleteProduct({ id: product.id }));
    const result = await done;

    if (!result.ok) {
      this.toast.show(result.failure.message, 'danger');
      return;
    }

    this.toast.show(`${product.name} deleted`, 'danger');
    this.menu.reload();
  }

  fieldError(name: string): string | null {
    return this.fieldErrors()[name] ?? null;
  }
}
