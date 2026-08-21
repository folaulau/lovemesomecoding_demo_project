import { expect, type Page } from '@playwright/test'

export const API = 'http://localhost:8000/api/v1'

export const ACCOUNTS = {
  guest: { email: 'guest@stayhub.test', password: 'guest123' },
  host: { email: 'host@stayhub.test', password: 'host123' },
  admin: { email: 'admin@stayhub.test', password: 'admin123' },
}

export async function login(page: Page, who: keyof typeof ACCOUNTS) {
  const account = ACCOUNTS[who]
  await page.goto('/login')
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button', { name: 'Log in' }).click()

  // ⚠️ NOT `page.waitForURL(...)`. That waits for a NAVIGATION event, and React Router changes
  // the URL client-side without ever firing one — so it hangs until the test times out. It also
  // starts observing only when called, so a redirect that already completed is missed entirely.
  // `expect(page).not.toHaveURL` POLLS the current URL instead, which is correct for an SPA.
  await expect(page).not.toHaveURL(/\/login/)
}

/** A date range far enough out that no seeded booking collides with it, unique per test run. */
export function futureDates(offsetDays: number, nights = 2) {
  const start = new Date()
  start.setDate(start.getDate() + offsetDays)
  const end = new Date(start)
  end.setDate(end.getDate() + nights)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return { checkIn: iso(start), checkOut: iso(end) }
}

/** Talks to the API directly for setup and teardown a UI flow should not have to do. */
export async function apiLogin(who: keyof typeof ACCOUNTS): Promise<string> {
  const response = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ACCOUNTS[who]),
  })
  const body = await response.json()
  return body.accessToken
}

export async function apiCancelAll(token: string) {
  const list = await fetch(`${API}/bookings/mine`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json())

  // Tests must clean up what they create, or a failure poisons every later run: a leftover
  // booking blocks the dates the next run picks.
  for (const booking of list) {
    if (booking.isCancellable) {
      await fetch(`${API}/bookings/${booking.publicId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'e2e cleanup' }),
      })
    }
  }
}
