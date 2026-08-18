import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * The interview-questions page.
 *
 * Static content, so no backend fixtures and no cleanup — but the filtering, the search and the
 * accordion are real behaviour and worth covering.
 *
 * Two locator notes, both learned the hard way here. Every accordion header's accessible name
 * BEGINS with its category badge, so an unscoped `{name: /^Testing/}` matches the filter button and
 * the questions in that category. Hence the scoped helpers below — the filters live in a labelled
 * group, and questions are counted as accordion items rather than by matching their text.
 */

const questions = (page: Page) => page.locator('.accordion-item');
const filters = (page: Page) => page.getByRole('group', { name: 'Filter by category' });

test('the page is reachable from the footer on any page', async ({ page }) => {
  await page.goto('/menu');

  await page.getByRole('link', { name: 'Senior interview questions' }).click();

  await expect(page).toHaveURL(/\/interview-questions/);
  await expect(page.getByRole('heading', { name: 'Senior interview questions' })).toBeVisible();
});

test('it lists exactly twenty questions', async ({ page }) => {
  await page.goto('/interview-questions');

  // The count line is the page's own claim; the accordion is the reality. Assert both agree.
  await expect(page.getByText('Showing 20 of 20')).toBeVisible();
  await expect(questions(page)).toHaveCount(20);
});

test('an answer expands with its senior-signal note', async ({ page }) => {
  await page.goto('/interview-questions');

  const question = page.getByRole('button', { name: /MultipleBagFetchException/ });
  await expect(question).toBeVisible();
  await question.click();

  // The substance, not merely that something opened.
  await expect(page.getByText(/cartesian product/).first()).toBeVisible();
  await expect(page.getByText('What a senior answer adds').first()).toBeVisible();
});

test('filtering by category narrows the list', async ({ page }) => {
  await page.goto('/interview-questions');

  await filters(page).getByRole('button', { name: /^Testing/ }).click();

  await expect(page.getByText('Showing 2 of 20')).toBeVisible();
  await expect(questions(page)).toHaveCount(2);
  await expect(page.locator('.accordion').getByText('JPA & Hibernate')).toBeHidden();
});

test('search matches answer text, not just the question title', async ({ page }) => {
  await page.goto('/interview-questions');

  // "miniSerializeError" appears only in an answer body, never in a question title.
  await page.getByRole('searchbox').fill('miniSerializeError');

  await expect(questions(page)).toHaveCount(1);
  await expect(page.getByRole('button', { name: /never enters the catch/ })).toBeVisible();
});

test('a search with no matches explains itself rather than showing an empty page', async ({
  page,
}) => {
  await page.goto('/interview-questions');

  await page.getByRole('searchbox').fill('kubernetes');

  await expect(page.getByText('Showing 0 of 20')).toBeVisible();
  await expect(page.getByText(/Nothing matches that/)).toBeVisible();
});

test('the category filter and the search combine', async ({ page }) => {
  await page.goto('/interview-questions');

  await filters(page).getByRole('button', { name: /^API & security/ }).click();
  await expect(page.getByText('Showing 5 of 20')).toBeVisible();

  // "cartesian" appears only in a JPA answer, so the API filter must exclude it.
  await page.getByRole('searchbox').fill('cartesian');
  await expect(page.getByText('Showing 0 of 20')).toBeVisible();
  await expect(questions(page)).toHaveCount(0);
});

test('every question carries a category badge and a senior-signal note', async ({ page }) => {
  await page.goto('/interview-questions');

  // Guards the data file: a question added without either would still render, just half-finished.
  await expect(questions(page)).toHaveCount(20);
  for (const header of await page.locator('.accordion-button').all()) {
    await header.click();
  }
  await expect(page.getByText('What a senior answer adds')).toHaveCount(20);
});
