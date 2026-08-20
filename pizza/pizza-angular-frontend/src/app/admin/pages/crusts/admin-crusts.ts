import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Actions } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { MenuService } from '../../../core/menu.service';
import { ToastService } from '../../../core/toast.service';
import { MoneyPipe } from '../../../core/money.pipe';
import { Modal } from '../../../shared/modal/modal';
import { Spinner } from '../../../shared/spinner/spinner';
import { CatalogActions, catalogFeature } from '../../store/catalog.store';
import { outcome } from '../../store/outcome';
import type { Crust, CrustWriteRequest } from '../../../core/models';

@Component({
  selector: 'app-admin-crusts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Modal, Spinner, MoneyPipe],
  templateUrl: './admin-crusts.html',
})
export class AdminCrusts {
  private readonly store = inject(Store);
  private readonly actions$ = inject(Actions);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly menu = inject(MenuService);

  readonly crusts = this.store.selectSignal(catalogFeature.selectCrusts);
  readonly loading = this.store.selectSignal(catalogFeature.selectLoading);
  readonly error = this.store.selectSignal(catalogFeature.selectError);

  readonly editing = signal<Crust | 'new' | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly fieldErrors = signal<Record<string, string>>({});

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    priceDelta: [0, [Validators.required, Validators.min(0)]],
    active: [true],
    displayOrder: [0],
  });

  constructor() {
    this.store.dispatch(CatalogActions.loadCrusts());
  }

  open(crust: Crust | 'new'): void {
    this.form.reset(
      crust === 'new'
        ? { name: '', priceDelta: 0, active: true, displayOrder: 0 }
        : {
            name: crust.name,
            priceDelta: crust.priceDelta,
            active: crust.active,
            displayOrder: crust.displayOrder,
          },
    );
    this.fieldErrors.set({});
    this.formError.set(null);
    this.editing.set(crust);
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
    const body = this.form.getRawValue() as CrustWriteRequest;

    const done = outcome(
      this.actions$,
      CatalogActions.saveCrustSuccess,
      CatalogActions.saveCrustFailure,
    );
    this.store.dispatch(CatalogActions.saveCrust({ id, body }));
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

  async remove(crust: Crust): Promise<void> {
    const done = outcome(
      this.actions$,
      CatalogActions.deleteCrustSuccess,
      CatalogActions.deleteCrustFailure,
    );
    this.store.dispatch(CatalogActions.deleteCrust({ id: crust.id }));
    const result = await done;

    if (!result.ok) {
      this.toast.show(result.failure.message, 'danger');
      return;
    }

    this.toast.show(`${crust.name} deleted`, 'danger');
    this.menu.reload();
  }

  fieldError(name: string): string | null {
    return this.fieldErrors()[name] ?? null;
  }
}
