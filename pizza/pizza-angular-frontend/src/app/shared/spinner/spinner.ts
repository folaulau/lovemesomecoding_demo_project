import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/* ==========================================================================
 * ANGULAR CONCEPT: a standalone component with a signal input
 *
 * `standalone` is the default since Angular 19 — there is no NgModule anywhere in this app. A
 * component declares what it uses in its own `imports` array, which is the same mental model as an
 * `import` statement in a React file.
 *
 * `input()` is the signal-based replacement for the `@Input()` decorator. The value is a SIGNAL,
 * so `label()` in the template subscribes to it, and `input.required<T>()` makes a missing input a
 * compile error rather than an undefined at runtime.
 *
 * `OnPush` tells Angular to re-render this component only when an input changes or a signal it
 * read changes — not on every change-detection pass. In a zoneless app (this one) it is close to
 * free, but it is set everywhere here because it is the habit worth having.
 * ========================================================================== */
@Component({
  selector: 'app-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="text-center" [class.py-5]="!inline()">
      <div class="spinner-border text-danger" role="status">
        <span class="visually-hidden">{{ label() }}</span>
      </div>
    </div>
  `,
})
export class Spinner {
  readonly label = input('Loading…');
  readonly inline = input(false);
}
