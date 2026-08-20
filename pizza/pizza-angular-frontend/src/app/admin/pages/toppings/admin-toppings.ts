import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Actions } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { MenuService } from '../../../core/menu.service';
import { ToastService } from '../../../core/toast.service';
import { MoneyPipe, humanise } from '../../../core/money.pipe';
import { Modal } from '../../../shared/modal/modal';
import { Spinner } from '../../../shared/spinner/spinner';
import { CatalogActions, catalogFeature } from '../../store/catalog.store';
import { outcome } from '../../store/outcome';
import type { Topping, ToppingCategory, ToppingWriteRequest } from '../../../core/models';

const CATEGORIES: ToppingCategory[] = ['MEAT', 'VEGGIE', 'CHEESE'];

@Component({
  selector: 'app-admin-toppings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Modal, Spinner, MoneyPipe],
  templateUrl: './admin-toppings.html',
})
export class AdminToppings {
  private readonly store = inject(Store);
  private readonly actions$ = inject(Actions);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly menu = inject(MenuService);

  readonly categories = CATEGORIES;

  readonly toppings = this.store.selectSignal(catalogFeature.selectToppings);
  readonly loading = this.store.selectSignal(catalogFeature.selectLoading);
  readonly error = this.store.selectSignal(catalogFeature.selectError);

  readonly editing = signal<Topping | 'new' | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly fieldErrors = signal<Record<string, string>>({});

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    price: [1, [Validators.required, Validators.min(0)]],
    category: ['MEAT' as ToppingCategory],
    active: [true],
  });

  constructor() {
    this.store.dispatch(CatalogActions.loadToppings());
  }

  label(value: string): string {
    return humanise(value);
  }

  open(topping: Topping | 'new'): void {
    this.form.reset(
      topping === 'new'
        ? { name: '', price: 1, category: 'MEAT', active: true }
        : {
            name: topping.name,
            price: topping.price,
            category: topping.category,
            active: topping.active,
          },
    );
    this.fieldErrors.set({});
    this.formError.set(null);
    this.editing.set(topping);
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
    const body = this.form.getRawValue() as ToppingWriteRequest;

    const done = outcome(
      this.actions$,
      CatalogActions.saveToppingSuccess,
      CatalogActions.saveToppingFailure,
    );
    this.store.dispatch(CatalogActions.saveTopping({ id, body }));
    const result = await done;

    this.saving.set(false);

    if (!result.ok) {
      this.fieldErrors.set(result.failure.fieldErrors);
      this.formError.set(result.failure.message);
      return;
    }

    this.toast.show(`${body.name} ${id ? 'updated' : 'created'}`);
    this.editing.set(null);
    this.menu.reload();
  }

  async remove(topping: Topping): Promise<void> {
    const done = outcome(
      this.actions$,
      CatalogActions.deleteToppingSuccess,
      CatalogActions.deleteToppingFailure,
    );
    this.store.dispatch(CatalogActions.deleteTopping({ id: topping.id }));
    const result = await done;

    if (!result.ok) {
      this.toast.show(result.failure.message, 'danger');
      return;
    }

    this.toast.show(`${topping.name} deleted`, 'danger');
    this.menu.reload();
  }

  fieldError(name: string): string | null {
    return this.fieldErrors()[name] ?? null;
  }
}
