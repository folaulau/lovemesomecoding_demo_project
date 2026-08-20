import { Directive, ElementRef, afterNextRender, booleanAttribute, inject, input } from '@angular/core';

/* ==========================================================================
 * ANGULAR CONCEPT: a directive
 *
 * A directive is a component without a template — behaviour attached to an element that someone
 * else owns. The selector is an ATTRIBUTE, `[appAutofocus]`, so adding it to an <input> changes
 * what the element DOES without changing the markup or wrapping it in anything.
 *
 * That "without wrapping it" is the part with no React equivalent. The same job there is a custom
 * hook plus a ref, which means the element's owner has to declare the ref and call the hook —
 * the behaviour cannot be attached from the outside. An attribute can be dropped onto an element
 * in a template you do not control.
 *
 * WHY `afterNextRender` AND NOT THE CONSTRUCTOR. `inject(ElementRef)` hands back the host element
 * straight away, but focusing it in the constructor is too early: the element exists and is not
 * yet in the document, and `.focus()` on a detached node does nothing at all — silently, which is
 * what makes it worth a comment. `afterNextRender` runs once the DOM has been written, the first
 * moment the call can succeed.
 *
 * `Modal` reaches for `afterRenderEffect` to solve the same problem. The difference is lifetime:
 * the modal re-focuses every time it reopens, so it needs an effect that re-runs; this needs to
 * fire once, so it uses the one-shot.
 * ========================================================================== */
@Directive({
  selector: '[appAutofocus]',
})
export class Autofocus {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /* ==========================================================================
   * ANGULAR CONCEPT: an input transform, and an input named after its own selector
   *
   * An input with the SAME NAME as the selector is how a directive takes its main argument: the
   * attribute doubles as the binding, so `appAutofocus` on its own is the switched-on case and
   * `[appAutofocus]="false"` turns it off without removing the attribute.
   *
   * The catch is that a bare attribute arrives as the empty string, not as `true`. `booleanAttribute`
   * is Angular's built-in transform for exactly that: '' becomes true, "false" becomes false, and
   * the input's declared type stays `boolean` so nothing downstream has to think about it. Writing
   * the coercion by hand in every such input is the thing it replaces.
   * ========================================================================== */
  readonly appAutofocus = input(true, { transform: booleanAttribute });

  constructor() {
    afterNextRender(() => {
      if (this.appAutofocus()) this.host.nativeElement.focus();
    });
  }
}
