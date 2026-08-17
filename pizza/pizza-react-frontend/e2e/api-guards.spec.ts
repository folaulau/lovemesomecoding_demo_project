import { expect, test } from '@playwright/test';

/**
 * The two guarantees that are NOT observable through the UI.
 *
 * Everything else in this suite drives the browser. These two check the API contract directly,
 * because the whole point is what happens when a request does NOT come from our frontend.
 */

const API = 'http://localhost:8085';

test('the API publishes UUIDs, never sequential ids', async ({ request }) => {
  const products = await (await request.get(`${API}/api/products`)).json();

  expect(products.length).toBe(14);
  for (const product of products) {
    // A sequential id would let anyone walk /api/orders/1, /2, /3.
    expect(product.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  }
});

test('the server ignores prices sent by the client', async ({ request }) => {
  const products = await (await request.get(`${API}/api/products?type=PIZZA`)).json();
  const pepperoni = products.find((p: { name: string }) => p.name === 'Pepperoni Pizza');

  // An attacker posting straight at the API, claiming their own prices.
  const response = await request.post(`${API}/api/orders`, {
    data: {
      orderType: 'CARRYOUT',
      customerName: 'Cheapskate',
      guestEmail: 'cheap@example.com',
      subtotal: 0.01,
      total: 0.01,
      items: [
        { productId: pepperoni.id, size: 'LARGE', quantity: 1, unitPrice: 0.01, lineTotal: 0.01 },
      ],
    },
  });

  expect(response.status()).toBe(201);
  const body = await response.json();
  // Claimed 0.01; charged the real price.
  expect(body.order.subtotal).toBe(16.99);
  expect(body.order.total).toBe(18.43);
});

test('a saved cart never stores prices — they are recomputed on read', async ({ request }) => {
  const products = await (await request.get(`${API}/api/products?type=PIZZA`)).json();
  const pepperoni = products.find((p: { name: string }) => p.name === 'Pepperoni Pizza');

  const cart = await (await request.post(`${API}/api/carts`)).json();

  // Try to smuggle prices into the cart as well.
  const saved = await (
    await request.put(`${API}/api/carts/${cart.id}`, {
      data: {
        orderType: 'CARRYOUT',
        subtotal: 0.01,
        total: 0.01,
        items: [
          { productId: pepperoni.id, size: 'LARGE', quantity: 1, unitPrice: 0.01, lineTotal: 0.01 },
        ],
      },
    })
  ).json();

  expect(saved.items[0].unitPrice).toBe(16.99);
  expect(saved.subtotal).toBe(16.99);
});
