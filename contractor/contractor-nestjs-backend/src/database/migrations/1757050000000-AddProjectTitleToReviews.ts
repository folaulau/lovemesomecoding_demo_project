import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Denormalises the project title onto the review row.
 *
 * ── Why ──────────────────────────────────────────────────────────────────────────────────────
 * A contractor's public profile lists their reviews, and each one says which job it was for. The
 * obvious way to render that is to follow the relationship — `review.project.title` — and it
 * fails, but not with an error anyone would recognise:
 *
 *     field 'project' not found in type: 'reviews'
 *
 * Hasura hides a relationship field from a role that has no `select` permission on the table it
 * points at. `projects` is deliberately unreadable by `anonymous`, because a project row carries
 * the homeowner's address, their budget and their schedule. So the relationship is not missing —
 * it is correctly withheld, and the review's own title travels with it.
 *
 * ── Why denormalise rather than open up `projects` ───────────────────────────────────────────
 * A narrow permission ("anonymous may read `title` on completed projects") would work and would be
 * the wrong shape: it makes the public profile depend on a permission written for another table,
 * and the next person to tighten that permission breaks a page they never looked at.
 *
 * Storing the title is also more correct. A review is a statement about a job AS IT WAS when the
 * work was done — the same reasoning that already puts `contractor_profile_id` on this table
 * rather than walking `project → accepted quote → contractor`.
 *
 * ⚠️ The usual cost of denormalisation applies: renaming a project no longer renames it in the
 * reviews. That is the intended behaviour here, not an oversight.
 */
export class AddProjectTitleToReviews1757050000000 implements MigrationInterface {
  name = 'AddProjectTitleToReviews1757050000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    /**
     * ⚠️ Three steps: add NULLABLE, backfill, then enforce NOT NULL.
     *
     * `ADD COLUMN … NOT NULL` in one statement is rejected on a table that already has rows, since
     * every existing row would instantly violate it. A `DEFAULT ''` would be accepted and is
     * worse: it succeeds silently and leaves every historical review labelled with an empty job.
     */
    await queryRunner.query(`ALTER TABLE "reviews" ADD COLUMN "project_title" VARCHAR(160)`)

    await queryRunner.query(`
      UPDATE "reviews" r
      SET "project_title" = p."title"
      FROM "projects" p
      WHERE p."id" = r."project_id"
    `)

    await queryRunner.query(`ALTER TABLE "reviews" ALTER COLUMN "project_title" SET NOT NULL`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN "project_title"`)
  }
}
