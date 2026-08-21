import { expect, test } from '@playwright/test'
import { login } from './helpers'

test.describe('Authentication', () => {
  test('a guest can sign in and see their trips', async ({ page }) => {
    await login(page, 'guest')
    await page.goto('/trips')
    await expect(page.getByRole('heading', { name: 'My trips' })).toBeVisible()
  })

  test('a wrong password is refused without saying which half was wrong', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('guest@stayhub.test')
    await page.getByLabel('Password').fill('definitely-not-the-password')
    await page.getByRole('button', { name: 'Log in' }).click()

    // Deliberately vague. The same sentence appears for an email that has no account — telling
    // them apart would turn this form into an account-enumeration oracle.
    await expect(page.getByText('Email or password is incorrect.')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('an unknown email gives the SAME message as a wrong password', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('nobody-at-all@stayhub.test')
    await page.getByLabel('Password').fill('whatever123')
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page.getByText('Email or password is incorrect.')).toBeVisible()
  })

  test('a signed-out visitor is sent to login and back again', async ({ page }) => {
    await page.goto('/trips')
    await expect(page).toHaveURL(/\/login/)

    await page.getByLabel('Email').fill('guest@stayhub.test')
    await page.getByLabel('Password').fill('guest123')
    await page.getByRole('button', { name: 'Log in' }).click()

    // The guard remembered where they were going.
    await expect(page).toHaveURL(/\/trips/)
  })

  test('the session survives a hard reload', async ({ page }) => {
    await login(page, 'guest')
    await page.goto('/trips')
    await expect(page.getByRole('heading', { name: 'My trips' })).toBeVisible()

    // ⚠️ The regression this guards: reviving a session is async, so `user` is null on the first
    // render. A ProtectedRoute that redirects without waiting for `loading` bounces every
    // signed-in user to /login on refresh — invisible while clicking around.
    await page.reload()
    await expect(page.getByRole('heading', { name: 'My trips' })).toBeVisible()
    await expect(page).toHaveURL(/\/trips/)
  })

  test('signing out clears the session', async ({ page }) => {
    await login(page, 'guest')
    await page.getByRole('button', { name: /Account menu/i }).click()
    await page.getByRole('menuitem', { name: 'Sign out' }).click()

    await page.goto('/trips')
    await expect(page).toHaveURL(/\/login/)
  })
})
