import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { ApiError } from './api-error';
import { apiInterceptor } from './api.interceptor';
import { tokenStore } from './storage';

/* ==========================================================================
 * ANGULAR CONCEPT: HttpTestingController
 *
 * `provideHttpClientTesting()` swaps the real HTTP backend for one that never touches the network
 * and instead hands you every request as an object to assert on. That is what makes an interceptor
 * — otherwise invisible plumbing — directly testable: make a request, then inspect the one that
 * came out the other end.
 *
 * `httpMock.verify()` in `afterEach` is the part people leave out and then regret. It fails the
 * test if a request was made that no expectation consumed, which is how you find out that a
 * component fires a second request you never knew about.
 *
 * ⚠️ ORDER MATTERS in the providers below. `provideHttpClientTesting()` must come AFTER
 * `provideHttpClient()`, because it replaces the backend the first one installed. Reversed, the
 * real backend wins and the tests try to hit the network.
 * ========================================================================== */
describe('apiInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    tokenStore.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    tokenStore.clear();
  });

  it('prefixes an /api/ request with the configured base URL', () => {
    http.get('/api/products').subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/products`);
    expect(req.request.method).toBe('GET');
  });

  it('attaches the bearer token when one is stored', () => {
    tokenStore.set('a-test-token');

    http.get('/api/me/orders').subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/me/orders`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer a-test-token');
  });

  it('sends no Authorization header for a guest', () => {
    http.get('/api/products').subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/products`);
    expect(req.request.headers.has('Authorization')).toBe(false);
  });

  it('leaves a non-API request alone, token or not', () => {
    // The security case: our bearer token must never be sent to a third party.
    tokenStore.set('a-test-token');

    http.get('https://api.stripe.com/v1/something').subscribe();

    const req = httpMock.expectOne('https://api.stripe.com/v1/something');
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(req.request.url).toBe('https://api.stripe.com/v1/something');
  });

  it('converts a failure into an ApiError before any caller sees it', async () => {
    const failure = new Promise<unknown>((resolve) => {
      http.get('/api/products').subscribe({ error: resolve });
    });

    httpMock
      .expectOne(`${environment.apiBaseUrl}/api/products`)
      .flush({ message: 'Boom' }, { status: 500, statusText: 'Server Error' });

    const error = await failure;
    // The point of the interceptor: one error type downstream, not Angular's transport wrapper.
    expect(error).toBeInstanceOf(ApiError);
  });
});
