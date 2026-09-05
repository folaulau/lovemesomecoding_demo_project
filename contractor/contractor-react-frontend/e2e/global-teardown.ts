/**
 * Deletes everything the Playwright suite created.
 *
 * ⚠️ Without this, each run leaves a completed project, its quote and its review in the database.
 * The next run's lead feed picks them up, the contractor directory shows a rating computed partly
 * from a test review, and a count assertion fails somewhere unrelated — a failure that looks like a
 * bug in the app and is really yesterday's test data.
 *
 * The UI has no delete, deliberately — a homeowner cannot erase a completed job, and adding an
 * endpoint just so the tests can tidy up would put a destructive route in the product to serve the
 * test suite. So this reaches past the app and talks to Postgres directly, which is the honest
 * version of what a teardown is doing anyway.
 */

import { execFileSync } from 'node:child_process'

/** Anything the specs create is titled with this prefix. See `journey.spec.ts`. */
const TEST_TITLE_PREFIX = 'E2E '

function psql(sql: string): string {
  // `execFileSync` with an argument ARRAY, never `execSync` with an interpolated string — there is
  // no shell here to mis-parse the quoting in the SQL below.
  return execFileSync(
    'docker',
    ['exec', 'contractor-postgres', 'psql', '-U', 'contractor', '-d', 'contractor', '-tAc', sql],
    { encoding: 'utf8' },
  ).trim()
}

export default function globalTeardown() {
  try {
    // Quotes and reviews cascade from the project (ON DELETE CASCADE), so one statement is enough.
    const deleted = psql(
      `WITH gone AS (DELETE FROM projects WHERE title LIKE '${TEST_TITLE_PREFIX}%' RETURNING 1)
       SELECT count(*) FROM gone`,
    )

    // ⚠️ Then recompute the cached ratings. Deleting a test review does NOT restore the average it
    // contributed to — that number lives on `contractor_profiles`, and leaving it means the
    // directory keeps showing a rating derived from a review that no longer exists.
    psql(`
      UPDATE contractor_profiles p SET
        review_count   = COALESCE(r.count, 0),
        rating_average = COALESCE(r.average, 0)
      FROM (SELECT id FROM contractor_profiles) all_p
      LEFT JOIN (
        SELECT contractor_profile_id AS id, COUNT(*) AS count, ROUND(AVG(rating), 2) AS average
        FROM reviews GROUP BY contractor_profile_id
      ) r ON r.id = all_p.id
      WHERE p.id = all_p.id
    `)

    if (Number(deleted) > 0) {
      console.log(`\n[teardown] removed ${deleted} test project(s) and recomputed ratings`)
    }
  } catch (error) {
    // A failed teardown must not turn a green run red — the tests already passed. It does need to
    // be loud, because the next run is the one that will suffer.
    console.warn(
      `\n[teardown] could not clean up test data: ${error instanceof Error ? error.message : error}` +
        `\n[teardown] run this by hand before the next suite:` +
        `\n  docker exec contractor-postgres psql -U contractor -d contractor ` +
        `-c "DELETE FROM projects WHERE title LIKE '${TEST_TITLE_PREFIX}%'"`,
    )
  }
}
