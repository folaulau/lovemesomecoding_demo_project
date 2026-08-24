import { authApi, cartApi, catalogApi, orderApi, profileApi } from '..';
import { apiClient } from '../client';

/**
 * The endpoint modules are thin, and that is exactly why they are worth testing.
 *
 * <p>Each one is a URL, a verb and an "does this need a token" flag. A typo in any of the three
 * compiles perfectly and fails at runtime against a real backend — a 404 on
 * `/api/me/payment-method`, or, worse, an authenticated endpoint called without a token and
 * quietly returning someone else's empty list. Asserting the shape here catches all of it in
 * milliseconds.
 */
jest.mock('../client', () => ({
  apiClient: {
    get: jest.fn(async () => undefined),
    post: jest.fn(async () => undefined),
    put: jest.fn(async () => undefined),
    patch: jest.fn(async () => undefined),
    delete: jest.fn(async () => undefined),
  },
}));

const client = apiClient as jest.Mocked<typeof apiClient>;

beforeEach(() => jest.clearAllMocks());

describe('catalogApi — public, no token', () => {
  it.each([
    ['listProducts', '/api/products'],
    ['listToppings', '/api/toppings'],
    ['listCrusts', '/api/crusts'],
  ] as const)('%s hits %s without auth', async (method, path) => {
    await catalogApi[method]();
    expect(client.get).toHaveBeenCalledWith(path, { signal: undefined });
    // Browsing the menu must never require an account.
    expect(client.get.mock.calls[0]?.[1]).not.toMatchObject({ auth: true });
  });
});

describe('cartApi', () => {
  it('creates a cart', async () => {
    await cartApi.create();
    expect(client.post).toHaveBeenCalledWith('/api/carts');
  });

  it('reads one by id', async () => {
    await cartApi.get('cart-1');
    expect(client.get).toHaveBeenCalledWith('/api/carts/cart-1', { signal: undefined });
  });

  it('REPLACES the whole cart with a PUT, so a retry is idempotent', async () => {
    const body = { orderType: 'DELIVERY' as const, items: [] };
    await cartApi.replace('cart-1', body);
    expect(client.put).toHaveBeenCalledWith('/api/carts/cart-1', body);
  });
});

describe('orderApi', () => {
  it('sends the token when the customer is signed in', async () => {
    await orderApi.create({ orderType: 'CARRYOUT', customerName: 'A', items: [] }, true);
    expect(client.post).toHaveBeenCalledWith('/api/orders', expect.anything(), { auth: true });
  });

  it('omits the token for a guest — guest checkout must work end to end', async () => {
    await orderApi.create({ orderType: 'CARRYOUT', customerName: 'A', items: [] }, false);
    expect(client.post).toHaveBeenCalledWith('/api/orders', expect.anything(), { auth: false });
  });

  it('asks the SERVER for the payment status', async () => {
    await orderApi.paymentStatus('order-1');
    expect(client.get).toHaveBeenCalledWith('/api/orders/order-1/payment-status', {
      signal: undefined,
    });
  });

  it('lists the caller’s own orders, authenticated and paginated', async () => {
    await orderApi.listMine(2, 5);
    expect(client.get).toHaveBeenCalledWith('/api/orders/mine?page=2&size=5', {
      auth: true,
      signal: undefined,
    });
  });
});

describe('authApi', () => {
  it('logs in', async () => {
    await authApi.login('a@b.test', 'pw');
    expect(client.post).toHaveBeenCalledWith('/api/auth/login', {
      email: 'a@b.test',
      password: 'pw',
    });
  });

  it('registers WITHOUT a role field — the server always creates a CUSTOMER', async () => {
    await authApi.register('a@b.test', 'pw', 'A B');
    const [, body] = client.post.mock.calls[0]!;
    expect(body).toEqual({ email: 'a@b.test', password: 'pw', fullName: 'A B' });
    expect(body).not.toHaveProperty('role');
  });

  it('validates the stored token', async () => {
    await authApi.me();
    expect(client.get).toHaveBeenCalledWith('/api/auth/me', { auth: true, signal: undefined });
  });
});

describe('profileApi — every route is /api/me/**, and every one is authenticated', () => {
  it('never puts a user id in the path', async () => {
    await profileApi.listAddresses();
    await profileApi.addAddress({ line1: '1 St', city: 'SF', state: 'CA', postalCode: '94105' });
    await profileApi.updateAddress('a1', {
      line1: '1 St',
      city: 'SF',
      state: 'CA',
      postalCode: '94105',
    });
    await profileApi.makeAddressPrimary('a1');
    await profileApi.deleteAddress('a1');
    await profileApi.listPaymentMethods();
    await profileApi.createSetupIntent();
    await profileApi.addPaymentMethod('pm_1');
    await profileApi.makePaymentMethodPrimary('p1');
    await profileApi.deletePaymentMethod('p1');

    const paths = [
      ...client.get.mock.calls,
      ...client.post.mock.calls,
      ...client.put.mock.calls,
      ...client.patch.mock.calls,
      ...client.delete.mock.calls,
    ].map(([path]) => path as string);

    expect(paths).toHaveLength(10);
    for (const path of paths) {
      expect(path).toMatch(/^\/api\/me\//);
    }
  });

  it('sends ONLY the Stripe token when saving a card', async () => {
    await profileApi.addPaymentMethod('pm_abc123');

    const [path, body, options] = client.post.mock.calls[0]!;
    expect(path).toBe('/api/me/payment-methods');
    // Never a number, never a CVC, never a cardholder name.
    expect(body).toEqual({ stripePaymentMethodId: 'pm_abc123' });
    expect(options).toEqual({ auth: true });
  });
});
