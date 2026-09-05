import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Renames the staff role from `admin` to `staff`.
 *
 * ── Why ──────────────────────────────────────────────────────────────────────────────────────
 * `admin` is Hasura's BUILT-IN superuser role — the one the admin secret grants. It bypasses every
 * permission in `hasura/metadata.mjs`, and Hasura will not let you define permissions for it:
 * applying metadata that tries produces *"cannot define permission for admin role"*.
 *
 * That refusal is the visible symptom. The real problem is what happens without it: a JWT whose
 * `x-hasura-default-role` is the literal string `admin` gets unrestricted read AND WRITE access to
 * every table through GraphQL. Every business rule in this app lives in a NestJS service, so a
 * write that reaches Postgres through Hasura is a write that passed none of them.
 *
 * ── Why a SECOND migration rather than editing the first ─────────────────────────────────────
 * ⚠️ Because `InitialSchema` has been applied. Postgres has already run it and the `migrations`
 * table has already recorded it, so editing it would change what a NEW database gets and nothing
 * else — every database that already exists keeps the old constraint, and the two diverge forever
 * with nothing to detect it.
 *
 * This is exactly the situation the "never edit an applied migration" rule is about, and it turned
 * up on day one, which is when it usually does.
 */
export class RenameAdminRoleToStaff1757040000000 implements MigrationInterface {
  name = 'RenameAdminRoleToStaff1757040000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    /**
     * ⚠️ DROP the constraint, THEN update the data, THEN add the new constraint. All three steps,
     * in that order.
     *
     * A CHECK constraint is enforced on every write, so while the old one is in place the UPDATE
     * below is rejected — the value it is writing is exactly the one the old constraint forbids:
     * `new row for relation "users" violates check constraint "ck_users_role"`. Reordering the
     * data and the constraint does not help either, because the new constraint is then validated
     * against rows that still say 'admin'. The only order that works is to have NO constraint for
     * the moment the data changes.
     *
     * That gap is safe here because TypeORM wraps each migration in a transaction, so no other
     * connection ever observes the table unconstrained.
     */
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "ck_users_role"`)
    await queryRunner.query(`UPDATE "users" SET "role" = 'staff' WHERE "role" = 'admin'`)
    await queryRunner.query(`
      ALTER TABLE "users" ADD CONSTRAINT "ck_users_role"
        CHECK ("role" IN ('homeowner', 'contractor', 'staff'))
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Same three steps, same order, mirrored.
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "ck_users_role"`)
    await queryRunner.query(`UPDATE "users" SET "role" = 'admin' WHERE "role" = 'staff'`)
    await queryRunner.query(`
      ALTER TABLE "users" ADD CONSTRAINT "ck_users_role"
        CHECK ("role" IN ('homeowner', 'contractor', 'admin'))
    `)
  }
}
