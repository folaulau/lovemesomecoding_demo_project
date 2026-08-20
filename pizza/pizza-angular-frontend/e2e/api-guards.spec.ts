import { expect, test } from '@playwright/test';
import { ADMIN, API, CUSTOMER, requireBackend, tokenFor } from './helpers';

/**
 * The rules the UI cannot enforce.
 *
 * <p>Every guard in the Angular app is a usability guard — anyone can edit client-side JavaScript.
 * These tests skip the browser entirely and ask the API directly, because that is where the
 * security boundary actually is.
 */

test.beforeAll(async ({ request }) => requireBackend(request));

test('an admin endpoint refuses an anonymous caller', async ({ request }) => {
  const response = await request.get(`${API}/api/admin/products`);
  expect([401, 403]).toContain(response.status());
});

test('an admin endpoint refuses a CUSTOMER token', async ({ request }) => {
  const token = await tokenFor(request, CUSTOMER);
  const response = await request.get(`${API}/api/admin/reports/dashboard?days=30`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.status()).toBe(403);
});

test('/api/me refuses an anonymous caller', async ({ request }) => {
  const response = await request.get(`${API}/api/me/addresses`);
  expect([401, 403]).toContain(response.status());
});

test("someone else's address is 404, not 403", async ({ request }) => {
  const adminToken = await tokenFor(request, ADMIN);
  const customerToken = await tokenFor(request, CUSTOMER);

  const customerAddresses = await request.get(`${API}/api/me/addresses`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  const [address] = await customerAddresses.json();
  test.skip(!address, 'the demo customer has no saved address to try');

  const response = await request.get(`${API}/api/me/addresses`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const adminAddresses = await response.json();

  // The admin's own list simply does not contain it — /api/me resolves the owner from the token,
  // so there is no id in the path to tamper with in the first place.
  expect(adminAddresses.find((a: { id: string }) => a.id === address.id)).toBeUndefined();

  // And reaching for it directly is a 404: a 403 would confirm the id exists.
  const direct = await request.put(`${API}/api/me/addresses/${address.id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { line1: 'x', city: 'x', state: 'CA', postalCode: '90210' },
  });
  expect(direct.status()).toBe(404);
});

test('registration cannot ask for the ADMIN role', async ({ request }) => {
  const email = `role-probe-${Date.now()}@pizza.test`;

  const response = await request.post(`${API}/api/auth/register`, {
    data: { email, password: 'password123', fullName: 'Role Probe', role: 'ADMIN' },
  });
  expect(response.ok()).toBeTruthy();

  const { user } = await response.json();
  // The field in the request body was ignored — the server decides the role.
  expect(user.role).toBe('CUSTOMER');

  const adminToken = await tokenFor(request, ADMIN);
  const users = await request.get(`${API}/api/admin/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const created = (await users.json()).find((u: { email: string }) => u.email === email);
  if (created) {
    await request.delete(`${API}/api/admin/users/${created.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
  }
});

test('an admin cannot demote themselves, whatever the UI offers', async ({ request }) => {
  const token = await tokenFor(request, ADMIN);
  const users = await request.get(`${API}/api/admin/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const self = (await users.json()).find((u: { email: string }) => u.email === ADMIN.email);

  const response = await request.patch(`${API}/api/admin/users/${self.id}/role`, {
    data: { role: 'CUSTOMER' },
    headers: { Authorization: `Bearer ${token}` },
  });

  // The disabled controls in the users table are a courtesy. This is the actual rule.
  expect(response.ok()).toBeFalsy();
});

test('a login failure says as little as possible', async ({ request }) => {
  const unknown = await request.post(`${API}/api/auth/login`, {
    data: { email: 'nobody@pizza.test', password: 'whatever' },
  });
  const wrongPassword = await request.post(`${API}/api/auth/login`, {
    data: { email: CUSTOMER.email, password: 'definitely-wrong' },
  });

  expect(unknown.status()).toBe(wrongPassword.status());
  // Identical answers: nothing here tells an attacker which accounts exist.
  expect((await unknown.json()).message).toBe((await wrongPassword.json()).message);
});
