import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../core/toast.service';

/**
 * Renders whatever {@link ToastService} is holding.
 *
 * <p>It lives once, at the top level of the app shell, and nothing else in the app knows it exists
 * — a page fires `toast.show('Saved')` and this picks it up. That is the point of putting the
 * state in a root service: the emitter and the renderer never have to meet.
 *
 * <p>The React app needs `createPortal` here, to escape ancestors with `overflow: hidden` and the
 * modal's stacking context. This component is already outside every page, so there is nothing to
 * escape and no portal.
 *
 * <p>top-end, not bottom-end: the cart drawer's Checkout button sits at the bottom-right and a
 * bottom-anchored toast covered it. The z-index in `theme.scss` clears Bootstrap's offcanvas
 * (1045) and modal (1055) so toasts fired from inside either are still visible.
 */
@Component({
  selector: 'app-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-container position-fixed top-0 end-0 p-3 toast-host">
      <!--
        ANGULAR CONCEPT: @for and the "track" expression.

        "track" is REQUIRED — it is how Angular matches a rendered node to an item across updates,
        the same job React's "key" prop does. Tracking by index would make a dismissed toast animate
        as if a different one had changed, because every later item would shift by one.
      -->
      @for (toast of toasts(); track toast.id) {
        <div class="toast show text-white align-items-center border-0 bg-{{ toast.variant }}" role="alert">
          <div class="toast-body d-flex justify-content-between align-items-center">
            <span>{{ toast.message }}</span>
            <button
              type="button"
              class="btn-close btn-close-white ms-3"
              aria-label="Dismiss notification"
              (click)="dismiss(toast.id)"
            ></button>
          </div>
        </div>
      }
    </div>
  `,
})
export class ToastHost {
  private readonly toastService = inject(ToastService);
  readonly toasts = this.toastService.toasts;

  dismiss(id: string): void {
    this.toastService.dismiss(id);
  }
}
