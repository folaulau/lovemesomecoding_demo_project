import { expect, test } from '@playwright/test'
import { API, ACCOUNTS, apiLogin } from './helpers'

/** Rules the UI enforces too, tested at the API — because the UI is not the security boundary.
 *  Every one of these is reachable with curl by anyone. */
test.describe('API guards', () => {
  test('a client-sent price is ignored', async () => {
    const token = await apiLogin('guest')
    const listing = await fetch(`${API}/search?q=joshua`).then((r) => r.json())
    const start = new Date()
    start.setDate(start.getDate() + 120)
    const end = new Date(start)
    end.setDate(end.getDate() + 2)
    const iso = (d: Date) => d.toISOString().slice(0, 10)

    const response = await fetch(`${API}/bookings`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyId: listing.hits[0].publicId,
        checkIn: iso(start),
        checkOut: iso(end),
        guests: 2,
        // Not part of the schema, and there is nowhere for it to land even if it were.
        total: '1.00',
        nightlyRate: '0.01',
      }),
    })
    const booking = await response.json()
    expect(response.status).toBe(201)
    expect(Number(booking.total)).toBeGreaterThan(100)

    await fetch(`${API}/bookings/${booking.publicId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'e2e cleanup' }),
    })
  })

  test('registration cannot grant itself a role', async () => {
    const email = `role-probe-${Date.now()}@stayhub.test`
    const response = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'password123',
        firstName: 'Role',
        lastName: 'Probe',
        role: 'ADMIN', // ignored — `role` is hardcoded to CUSTOMER in the service
      }),
    })
    const body = await response.json()
    expect(body.user.role).toBe('CUSTOMER')
  })

  test("another user's booking is a 404, not a 403", async () => {
    const guestToken = await apiLogin('guest')
    const hostToken = await apiLogin('host')

    const mine = await fetch(`${API}/bookings/mine`, {
      headers: { Authorization: `Bearer ${guestToken}` },
    }).then((r) => r.json())
    test.skip(mine.length === 0, 'no seeded booking to probe with')

    const response = await fetch(`${API}/bookings/${mine[0].publicId}`, {
      headers: { Authorization: `Bearer ${hostToken}` },
    })
    // 403 would confirm the id exists — on a guessable identifier that is a slow enumeration
    // of the whole table.
    expect(response.status).toBe(404)
  })

  test('a non-host cannot create a listing', async () => {
    const token = await apiLogin('guest')
    const response = await fetch(`${API}/properties`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Should not exist', city: 'Nowhere', pricePerNight: '10' }),
    })
    expect([403, 422]).toContain(response.status)
  })

  test('staff endpoints refuse a normal customer', async () => {
    const token = await apiLogin('guest')
    const response = await fetch(`${API}/admin/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(response.status).toBe(403)
  })

  test('Hasura hides the password hash from every role', async () => {
    for (const who of ['guest', 'host', 'admin'] as const) {
      const token = await apiLogin(who)
      const response = await fetch('http://localhost:8081/v1/graphql', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '{ users { passwordHash } }' }),
      }).then((r) => r.json())

      // The column is not in ANY role's select permission, so it is not even in the schema.
      expect(JSON.stringify(response)).toContain('not found in type')
    }
  })

  test('a guest cannot request the staff Hasura role', async () => {
    const token = await apiLogin('guest')
    const response = await fetch('http://localhost:8081/v1/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-hasura-role': 'staff',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: '{ users { email } }' }),
    }).then((r) => r.json())

    expect(response.errors?.[0]?.message).toMatch(/not in allowed roles/i)
  })
})
