import { ApplicationConfig, ErrorHandler, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideStore } from '@ngrx/store';
import { routes } from './app.routes';
import { apiInterceptor } from './core/api.interceptor';
import { GlobalErrorHandler } from './core/global-error-handler';

/**
 * Application-wide providers.
 *
 * <p>This is `main.tsx`'s stack of `<Provider>` components, flattened. Nothing here nests, because
 * a DI provider is looked up by TOKEN rather than by walking up the component tree — which is also
 * why the order of this array does not matter, while the order of React's providers does whenever
 * one of them consumes another.
 *
 * <p>Note also what is NOT here: the four stateful services. `providedIn: 'root'` registers them
 * from their own files, so adding one does not mean editing this file.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    // Reports unhandled promise rejections and window errors through the ErrorHandler below.
    provideBrowserGlobalErrorListeners(),

    provideRouter(
      routes,
      /*
       * `withComponentInputBinding` binds route params and query params straight to matching
       * `input()`s on the routed component — the OrderConfirmation page receives `orderId` without
       * ever injecting ActivatedRoute. It is Angular's answer to `useParams()`.
       */
      withComponentInputBinding(),
      // Land at the top on a new page; restore the old position on Back. Browsers do this for a
      // document navigation and cannot for a client-side one, so the router has to.
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
    ),

    /*
     * `withFetch` puts HttpClient on the Fetch API rather than XMLHttpRequest, which is the same
     * transport the React app uses directly. `withInterceptors` takes the functional interceptors —
     * the class-based `HTTP_INTERCEPTORS` multi-provider is the older form.
     */
    provideHttpClient(withFetch(), withInterceptors([apiInterceptor])),

    /*
     * The ROOT NgRx store — empty. Every feature that fills it is registered on the /admin route,
     * so the reducers, effects and actions stay in the lazy admin chunk.
     *
     * ⚠️ This one line cannot move to the route with them. `EffectsRunner` is `providedIn: 'root'`
     * and injects the Store, so a route-provided store is invisible to it and the first admin
     * navigation dies with `NG0201`. See the long note in `admin/store/index.ts`.
     */
    provideStore(),

    { provide: ErrorHandler, useClass: GlobalErrorHandler },
  ],
};
