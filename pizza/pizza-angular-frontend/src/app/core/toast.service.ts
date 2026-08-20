import { Injectable, signal } from '@angular/core';

export type ToastVariant = 'success' | 'danger' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  variant: ToastVariant;
}

/* ==========================================================================
 * ANGULAR CONCEPT: a signal-based service replaces a React Context
 *
 * The React app wraps the whole tree in `<ToastProvider>` so that any descendant can call
 * `useToast()`. Angular needs no wrapper at all: a `providedIn: 'root'` service IS a singleton
 * reachable from anywhere by `inject(ToastService)`, and the injector — not the component tree —
 * is what makes it shared.
 *
 * That is the single biggest structural difference between the two apps. Four Providers nested in
 * `main.tsx` over there; four `@Injectable`s and no nesting at all over here.
 *
 * The React version also needs `createPortal` to escape `overflow: hidden` and modal stacking
 * contexts. `<app-toast-host>` sits at the top level of the app shell instead — outside every
 * page — so there is nothing to escape from and no portal is needed.
 * ========================================================================== */
@Injectable({ providedIn: 'root' })
export class ToastService {
  /*
   * `signal` holds a value and tells anything that read it when the value changes. The private
   * writable signal plus a public read-only view is the standard shape: components can render
   * `toasts()` but cannot reach in and set it, so every mutation goes through the methods below.
   */
  private readonly _toasts = signal<ToastMessage[]>([]);
  readonly toasts = this._toasts.asReadonly();

  show(message: string, variant: ToastVariant = 'success'): void {
    const id = crypto.randomUUID();

    // `update` receives the current value — the safe way to derive from it, exactly like React's
    // functional `setState(current => …)`.
    this._toasts.update((current) => [...current, { id, message, variant }]);

    setTimeout(() => this.dismiss(id), 3000);
  }

  dismiss(id: string): void {
    this._toasts.update((current) => current.filter((toast) => toast.id !== id));
  }
}
