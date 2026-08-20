# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: checkout.spec.ts >> the browser cannot dictate a price — the server reprices the cart
- Location: e2e/checkout.spec.ts:70:5

# Error details

```
Error: response.json: Protocol error (Network.getResponseBody): No data found for resource with given identifier
Response body is not available for a response that was navigated away from. Read response.body() before triggering any navigation.
```

# Page snapshot

```yaml
- generic [ref=f1e3]:
  - navigation [ref=f1e5]:
    - generic [ref=f1e6]:
      - link "PizzaHub" [ref=f1e7] [cursor=pointer]:
        - /url: /
      - generic [ref=f1e8]:
        - list [ref=f1e9]:
          - listitem [ref=f1e10]:
            - link "Menu" [ref=f1e11] [cursor=pointer]:
              - /url: /menu
          - listitem [ref=f1e12]:
            - link "Pizzas" [ref=f1e13] [cursor=pointer]:
              - /url: /menu?type=PIZZA
          - listitem [ref=f1e14]:
            - link "Drinks" [ref=f1e15] [cursor=pointer]:
              - /url: /menu?type=DRINK
        - list [ref=f1e16]:
          - listitem [ref=f1e17]:
            - link "Sign in" [ref=f1e18] [cursor=pointer]:
              - /url: /login
          - listitem [ref=f1e19]:
            - button "Open cart, 1 items" [ref=f1e20] [cursor=pointer]:
              - text: Cart
              - generic [ref=f1e21]: "1"
  - main [ref=f1e22]:
    - generic [ref=f1e24]:
      - heading "Checkout" [level=1] [ref=f1e25]
      - generic [ref=f1e26]:
        - generic [ref=f1e29]:
          - heading "Payment" [level=2] [ref=f1e30]
          - generic [ref=f1e32]:
            - iframe [ref=f1e35]:
              
            - button "Pay $19.17" [ref=f1e37] [cursor=pointer]
            - paragraph [ref=f1e38]:
              - text: Test mode — use card
              - code [ref=f1e39]: 4242 4242 4242 4242
              - text: ", any future expiry, any CVC."
        - generic [ref=f1e42]:
          - heading "Order summary · Delivery" [level=2] [ref=f1e43]
          - generic [ref=f1e44]:
            - generic [ref=f1e45]: 1 × Pepperoni Pizza (Medium, Original Pan)
            - generic [ref=f1e46]: $13.99
          - separator [ref=f1e47]
          - generic [ref=f1e48]:
            - generic [ref=f1e49]: Subtotal
            - generic [ref=f1e50]: $13.99
          - generic [ref=f1e51]:
            - generic [ref=f1e52]: Tax
            - generic [ref=f1e53]: $1.19
          - generic [ref=f1e54]:
            - generic [ref=f1e55]: Delivery
            - generic [ref=f1e56]: $3.99
          - generic [ref=f1e57]:
            - generic [ref=f1e58]: Total
            - generic [ref=f1e59]: $19.17
          - paragraph [ref=f1e60]:
            - text: Order
            - code [ref=f1e61]: df43a39c-8bdb-499e-92fc-194119c9e35b
            - text: is reserved. It is not paid until the card is confirmed.
  - contentinfo [ref=f1e63]:
    - generic [ref=f1e64]:
      - group [ref=f1e65]:
        - generic "▸ Demo sign-ins" [ref=f1e66] [cursor=pointer]
      - generic [ref=f1e67]:
        - generic [ref=f1e68]: PizzaHub — the Angular build of the demo app for lovemesomecoding.com
        - generic [ref=f1e69]: Not a real restaurant. Please do not expect a pizza.
  - alert [ref=f1e70]:
    - generic [ref=f1e71]:
      - generic [ref=f1e72]: 1 × Pepperoni Pizza added to your cart
      - button "Dismiss notification" [ref=f1e73] [cursor=pointer]
```

# Test source

```ts
  1   | import { expect, test } from '@playwright/test';
  2   | import { API, CUSTOMER, addProduct, openCart, requireBackend, signIn } from './helpers';
  3   | 
  4   | /** Checkout: the two-step flow, validation, and who decides the price. */
  5   | 
  6   | test.beforeAll(async ({ request }) => requireBackend(request));
  7   | 
  8   | test.beforeEach(async ({ page }) => {
  9   |   await page.goto('/');
  10  |   await page.evaluate(() => localStorage.clear());
  11  | });
  12  | 
  13  | async function fillGuestDetails(page: import('@playwright/test').Page) {
  14  |   await page.getByLabel('Name').fill('Guest Diner');
  15  |   await page.getByLabel('Email').fill('guest@pizza.test');
  16  |   await page.getByLabel('Phone').fill('5551234567');
  17  |   await page.getByLabel('Street address').fill('1 Test Street');
  18  |   await page.getByLabel('City').fill('Testville');
  19  |   await page.getByLabel('State').fill('CA');
  20  |   await page.getByLabel('ZIP').fill('90210');
  21  | }
  22  | 
  23  | test('a GUEST can create an order end to end — signing in is never required', async ({ page }) => {
  24  |   await page.goto('/menu?type=PIZZA');
  25  |   await addProduct(page, 'Pepperoni Pizza', { size: 'MEDIUM' });
  26  | 
  27  |   const cart = await openCart(page);
  28  |   await cart.getByRole('button', { name: 'Checkout' }).click();
  29  | 
  30  |   await fillGuestDetails(page);
  31  |   await page.getByRole('button', { name: 'Continue to payment' }).click();
  32  | 
  33  |   // Step 2 only exists once the server has created the order and opened a PaymentIntent.
  34  |   await expect(page.getByRole('heading', { name: 'Payment' })).toBeVisible();
  35  |   await expect(page.getByText(/is reserved/)).toBeVisible();
  36  | });
  37  | 
  38  | test('the summary switches to the SERVER figures once the order exists', async ({ page }) => {
  39  |   await page.goto('/menu?type=PIZZA');
  40  |   await addProduct(page, 'Pepperoni Pizza', { size: 'MEDIUM' });
  41  | 
  42  |   const cart = await openCart(page);
  43  |   await cart.getByRole('button', { name: 'Checkout' }).click();
  44  |   await fillGuestDetails(page);
  45  | 
  46  |   /*
  47  |    * `.then(r => r.json())` is attached HERE, not awaited later. Playwright discards a response
  48  |    * body once the page navigates, and reading it after the await sometimes lost the race with
  49  |    * Stripe.js — "No data found for resource with given identifier". Chaining reads the body the
  50  |    * moment the response arrives.
  51  |    */
  52  |   const created = page
  53  |     .waitForResponse((r) => r.url().endsWith('/api/orders') && r.request().method() === 'POST')
  54  |     .then((r) => r.json());
  55  | 
  56  |   await page.getByRole('button', { name: 'Continue to payment' }).click();
  57  |   const order = (await created).order;
  58  | 
  59  |   /*
  60  |    * Whatever the browser was previewing, these are now the server's numbers.
  61  |    *
  62  |    * Scoped to the TOTAL row rather than "any element containing this figure" — the same amount can
  63  |    * legitimately appear twice in the summary (a single-line cart's line total equals its subtotal),
  64  |    * and a loose text match then fails on strict mode instead of on the thing being tested.
  65  |    */
  66  |   const summary = page.locator('.sticky-summary');
  67  |   await expect(summary.locator('.fs-5.fw-bold')).toContainText(`$${order.total.toFixed(2)}`);
  68  | });
  69  | 
  70  | test('the browser cannot dictate a price — the server reprices the cart', async ({ page, request }) => {
  71  |   await page.goto('/menu?type=PIZZA');
  72  |   await addProduct(page, 'Pepperoni Pizza', { size: 'MEDIUM' });
  73  | 
  74  |   const cart = await openCart(page);
  75  |   await cart.getByRole('button', { name: 'Checkout' }).click();
  76  |   await fillGuestDetails(page);
  77  | 
  78  |   // Request payload and response body both captured as the response arrives, before anything can
  79  |   // navigate away and discard them.
  80  |   const captured = page
  81  |     .waitForResponse((r) => r.url().endsWith('/api/orders') && r.request().method() === 'POST')
> 82  |     .then(async (r) => ({ sent: r.request().postData() ?? '{}', body: await r.json() }));
      |                                                                               ^ Error: response.json: Protocol error (Network.getResponseBody): No data found for resource with given identifier
  83  | 
  84  |   await page.getByRole('button', { name: 'Continue to payment' }).click();
  85  |   const { sent, body } = await captured;
  86  | 
  87  |   // Nothing resembling a price is even sent.
  88  |   expect(sent).not.toMatch(/price|subtotal|total/i);
  89  | 
  90  |   // And the server's total matches the menu: $13.99 + 8.5% tax + $3.99 delivery.
  91  |   const { order } = body;
  92  |   expect(order.subtotal).toBe(13.99);
  93  |   expect(order.deliveryFee).toBe(3.99);
  94  |   expect(order.total).toBeCloseTo(13.99 + 1.19 + 3.99, 2);
  95  | 
  96  |   // Leave the database as we found it.
  97  |   const login = await request.post(`${API}/api/auth/login`, {
  98  |     data: { email: 'admin@pizza.test', password: 'admin123' },
  99  |   });
  100 |   const { token } = await login.json();
  101 |   await request.patch(`${API}/api/admin/orders/${order.id}/status`, {
  102 |     data: { status: 'CANCELLED' },
  103 |     headers: { Authorization: `Bearer ${token}` },
  104 |   });
  105 | });
  106 | 
  107 | test('an incomplete address blocks the submit', async ({ page }) => {
  108 |   await page.goto('/menu?type=PIZZA');
  109 |   await addProduct(page, 'Pepperoni Pizza');
  110 | 
  111 |   const cart = await openCart(page);
  112 |   await cart.getByRole('button', { name: 'Checkout' }).click();
  113 | 
  114 |   await page.getByLabel('Name').fill('Guest Diner');
  115 |   await page.getByLabel('Email').fill('guest@pizza.test');
  116 |   // Street address, city, state and ZIP deliberately left blank.
  117 |   await page.getByRole('button', { name: 'Continue to payment' }).click();
  118 | 
  119 |   await expect(page.getByRole('heading', { name: 'Payment' })).toBeHidden();
  120 |   await expect(page.getByText('We cannot deliver without a street address.')).toBeVisible();
  121 | });
  122 | 
  123 | test('a malformed ZIP is rejected', async ({ page }) => {
  124 |   await page.goto('/menu?type=PIZZA');
  125 |   await addProduct(page, 'Pepperoni Pizza');
  126 |   const cart = await openCart(page);
  127 |   await cart.getByRole('button', { name: 'Checkout' }).click();
  128 | 
  129 |   await fillGuestDetails(page);
  130 |   await page.getByLabel('ZIP').fill('123');
  131 |   await page.getByRole('button', { name: 'Continue to payment' }).click();
  132 | 
  133 |   await expect(page.getByText('Five digits, please.')).toBeVisible();
  134 |   await expect(page.getByRole('heading', { name: 'Payment' })).toBeHidden();
  135 | });
  136 | 
  137 | test('choosing pickup drops the address fields AND their validators', async ({ page }) => {
  138 |   await page.goto('/menu?type=PIZZA');
  139 |   await addProduct(page, 'Pepperoni Pizza');
  140 |   const cart = await openCart(page);
  141 |   await cart.getByRole('button', { name: 'Checkout' }).click();
  142 | 
  143 |   await page.getByRole('button', { name: /Pick up/ }).click();
  144 |   await expect(page.getByLabel('Street address')).toBeHidden();
  145 | 
  146 |   /*
  147 |    * The bug this guards: leaving the address validators attached after the fields disappear makes
  148 |    * the form permanently invalid with nothing on screen to fix. Only name and email are filled.
  149 |    */
  150 |   await page.getByLabel('Name').fill('Guest Diner');
  151 |   await page.getByLabel('Email').fill('guest@pizza.test');
  152 |   await page.getByRole('button', { name: 'Continue to payment' }).click();
  153 | 
  154 |   await expect(page.getByRole('heading', { name: 'Payment' })).toBeVisible();
  155 |   // No delivery fee on a pickup.
  156 |   await expect(page.locator('.sticky-summary').getByText('Delivery')).toBeHidden();
  157 | });
  158 | 
  159 | test('a signed-in customer gets their PRIMARY address preselected', async ({ page }) => {
  160 |   await signIn(page, CUSTOMER);
  161 | 
  162 |   await page.goto('/menu?type=PIZZA');
  163 |   await addProduct(page, 'Pepperoni Pizza');
  164 |   const cart = await openCart(page);
  165 |   await cart.getByRole('button', { name: 'Checkout' }).click();
  166 | 
  167 |   const primary = page.locator('.form-check', { hasText: 'primary' }).locator('input[type=radio]');
  168 |   await expect(primary).toBeChecked();
  169 | 
  170 |   // With a saved address chosen there is nothing to type.
  171 |   await expect(page.getByLabel('Street address')).toBeHidden();
  172 | });
  173 | 
  174 | test('a signed-in customer can still type a different address', async ({ page }) => {
  175 |   await signIn(page, CUSTOMER);
  176 | 
  177 |   await page.goto('/menu?type=PIZZA');
  178 |   await addProduct(page, 'Pepperoni Pizza');
  179 |   const cart = await openCart(page);
  180 |   await cart.getByRole('button', { name: 'Checkout' }).click();
  181 | 
  182 |   await page.getByLabel('Use a different address').check();
```