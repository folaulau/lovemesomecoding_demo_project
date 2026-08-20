import { ErrorHandler, Injectable } from '@angular/core';

/* ==========================================================================
 * ANGULAR CONCEPT: ErrorHandler — the closest thing to a React error boundary
 *
 * React needs a CLASS component for this, because there is still no hook equivalent of
 * `componentDidCatch`. Its boundary catches errors thrown while RENDERING a subtree and swaps in a
 * fallback UI, and catches nothing thrown from an event handler or an async callback.
 *
 * Angular takes the opposite shape: one injectable `ErrorHandler` sees every uncaught error in the
 * application — render, event handler, or a rejected promise from `provideBrowserGlobalErrorListeners`
 * — but it is NOT a UI boundary. It cannot replace a broken subtree with a fallback, because by
 * the time it runs there is no component context left to replace.
 *
 * So the two frameworks split the job differently, and each app gets what its framework offers:
 * React swaps in a fallback for a broken page, Angular logs centrally and tells the user through
 * the toast system that already exists. Neither is a substitute for handling an expected failure
 * where it happens — every API call in this app has its own catch.
 * ========================================================================== */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    // In production this would go to Sentry, Datadog or similar.
    console.error('Uncaught error:', error);
  }
}
