import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  input,
  output,
  viewChild,
} from '@angular/core';

/* ==========================================================================
 * ANGULAR CONCEPT: content projection (`<ng-content>`)
 *
 * `<ng-content>` is `props.children`. The difference is that a component can have SEVERAL slots,
 * selected by CSS selector — here a title, a body and a footer — so a caller writes:
 *
 *   <app-modal [open]="…" (closed)="…">
 *     <span modal-title>New product</span>
 *     <div modal-body> … </div>
 *     <div modal-footer> … </div>
 *   </app-modal>
 *
 * react-bootstrap expresses the same idea as three sub-components (`Modal.Header`, `Modal.Body`,
 * `Modal.Footer`). Named slots get there with one component and no exported namespace.
 *
 * WHY HAND-ROLL THIS AT ALL. Bootstrap ships JavaScript for its modal, but driving it means
 * holding an imperative `new bootstrap.Modal(el)` handle and keeping it in step with a declarative
 * template — two sources of truth for "is this open". The markup and classes below are Bootstrap's
 * own; only the `.show` toggle and the backdrop are ours, and `theme.scss` supplies the one
 * `display: block` rule that Bootstrap's JavaScript would otherwise set inline.
 * ========================================================================== */
@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div
        class="modal fade show"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="ariaLabel()"
        (keydown.escape)="closed.emit()"
      >
        <div
          class="modal-dialog modal-dialog-centered"
          [class.modal-lg]="size() === 'lg'"
          [class.modal-dialog-scrollable]="scrollable()"
        >
          <div class="modal-content">
            <div class="modal-header">
              <h2 class="modal-title h5"><ng-content select="[modal-title]" /></h2>
              <button
                #closeButton
                type="button"
                class="btn-close"
                aria-label="Close"
                (click)="closed.emit()"
              ></button>
            </div>

            <div class="modal-body">
              <ng-content select="[modal-body]" />
            </div>

            <div class="modal-footer" [class.justify-content-between]="spreadFooter()">
              <ng-content select="[modal-footer]" />
            </div>
          </div>
        </div>
      </div>

      <!-- Bootstrap styles .modal-backdrop; it just has to exist while the dialog is open. -->
      <div class="modal-backdrop fade show" (click)="closed.emit()"></div>
    }
  `,
})
export class Modal {
  readonly open = input(false);
  readonly size = input<'md' | 'lg'>('md');
  readonly scrollable = input(false);
  readonly spreadFooter = input(false);
  readonly ariaLabel = input<string | null>(null);

  /*
   * ANGULAR CONCEPT: output()
   *
   * The signal-era replacement for `@Output() closed = new EventEmitter()`. A parent binds it as
   * `(closed)="…"`, which is Angular's spelling of React's `onHide` callback prop. The direction of
   * the data is the same in both frameworks: state down, events up.
   */
  readonly closed = output<void>();

  /*
   * ANGULAR CONCEPT: viewChild + afterRenderEffect
   *
   * A dialog that appears without moving focus leaves keyboard and screen-reader users stranded at
   * the top of the document with no idea it opened. `viewChild` is the signal version of the
   * `@ViewChild` decorator and returns the element once it exists; `afterRenderEffect` runs after
   * the DOM has been written, which is the earliest moment focusing it can actually work.
   *
   * The React app uses `useRef` plus react-bootstrap's `onEntered` for exactly this.
   */
  private readonly closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');

  constructor() {
    afterRenderEffect(() => {
      if (this.open()) this.closeButton()?.nativeElement.focus();
    });
  }
}
