import { apiClient } from '../client';
import { ApiError, NetworkError } from '../apiError';
import { tokenStore } from '@/storage';

/**
 * The HTTP client, against a mocked `fetch`.
 *
 * <p>Mocking at the `fetch` boundary rather than at the module boundary is deliberate: it exercises
 * the real header assembly, the real status handling and the real error mapping, which is where the
 * bugs actually live.
 */

const BASE = 'http://localhost:8085';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('apiClient', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    /*
     * `globalThis`, not `global`. Both exist under Jest, but `global` is a Node type this project
     * does not pull in (`types: ["jest"]` in tsconfig), while `globalThis` is standard ES2020 and
     * is also the spelling that works in Hermes.
     */
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(async () => {
    await tokenStore.clear();
  });

  it('GETs and parses the body', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ id: 'p1' }]));

    const result = await apiClient.get<{ id: string }[]>('/api/products');

    expect(result).toEqual([{ id: 'p1' }]);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE}/api/products`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('sends a JSON body and the matching content type', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'order-1' }));

    await apiClient.post('/api/orders', { customerName: 'Folau' });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBe(JSON.stringify({ customerName: 'Folau' }));
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('omits the Authorization header when auth is not requested', async () => {
    await tokenStore.set('jwt-123');
    fetchMock.mockResolvedValue(jsonResponse([]));

    await apiClient.get('/api/products');

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('attaches the stored token when auth is requested', async () => {
    await tokenStore.set('jwt-123');
    fetchMock.mockResolvedValue(jsonResponse([]));

    await apiClient.get('/api/orders/mine', { auth: true });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer jwt-123');
  });

  it('sends no Authorization header when auth is requested but no token is stored', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await apiClient.get('/api/orders/mine', { auth: true });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('returns undefined for 204 rather than trying to parse an empty body', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 204,
      text: async () => '',
    } as unknown as Response);

    await expect(apiClient.delete('/api/me/addresses/a1', { auth: true })).resolves.toBeUndefined();
  });

  it('throws an ApiError carrying the API error envelope', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          statusCode: 400,
          error: 'Bad Request',
          message: 'Validation failed',
          path: '/api/orders',
          timestamp: '2026-08-24T00:00:00Z',
          errors: [{ field: 'email', message: 'must be a well-formed email address' }],
        },
        400,
      ),
    );

    const error = await apiClient.post('/api/orders', {}).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(400);
    expect(apiError.message).toBe('Validation failed');
    expect(apiError.fieldErrors()).toEqual({ email: 'must be a well-formed email address' });
  });

  it('falls back to a generic message when the error body has none', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => '',
    } as unknown as Response);

    const error = (await apiClient.get('/api/products').catch((err: unknown) => err)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe('Request failed with 500');
  });

  it('turns an HTML error page into an ApiError, not a JSON parse crash', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => '<html>Bad Gateway</html>',
    } as unknown as Response);

    const error = (await apiClient.get('/api/products').catch((err: unknown) => err)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(502);
  });

  it('turns an unreachable server into a NetworkError naming the base URL', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    const error = (await apiClient
      .get('/api/products')
      .catch((err: unknown) => err)) as NetworkError;

    expect(error).toBeInstanceOf(NetworkError);
    expect(error.message).toContain(BASE);
  });

  it('aborts and reports a timeout when the server never answers', async () => {
    // Never resolves on its own — only the client's own AbortSignal ends it.
    fetchMock.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new Error('Aborted')));
        }),
    );

    const error = (await apiClient
      .get('/api/products', { timeoutMs: 10 })
      .catch((err: unknown) => err)) as NetworkError;

    expect(error).toBeInstanceOf(NetworkError);
    expect(error.message).toMatch(/took too long/i);
  });

  it('rethrows a caller-initiated abort untouched, so callers can ignore it', async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            const abortError = new Error('Aborted');
            abortError.name = 'AbortError';
            reject(abortError);
          });
        }),
    );

    const promise = apiClient.get('/api/products', { signal: controller.signal });
    controller.abort();

    const error = (await promise.catch((err: unknown) => err)) as Error;

    // NOT a NetworkError — an abort is a cancellation, not a failure.
    expect(error).not.toBeInstanceOf(NetworkError);
    expect(error.name).toBe('AbortError');
  });
});
