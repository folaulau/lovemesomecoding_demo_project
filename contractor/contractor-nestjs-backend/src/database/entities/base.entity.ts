import { Column, CreateDateColumn, Generated, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

/**
 * What every table in this schema has.
 *
 * TypeORM inherits columns from a plain base class — no `@Entity()` on it, no separate table. The
 * three columns below are on all eight tables, and defining them once is what stops the sixth
 * entity from quietly getting `timestamp` instead of `timestamptz`.
 *
 * ⚠️ Every multi-word column carries an explicit `name`, here and in every other entity.
 * TypeORM's default is to use the PROPERTY name verbatim, so `publicId` becomes a column called
 * `"publicId"` — quoted, case-sensitive, and painful to type in psql. The alternative is a global
 * `SnakeNamingStrategy`, which works but makes the mapping invisible: nothing in the entity then
 * tells you what the column is actually called. Spelling it out costs one option per column and
 * removes the question entirely.
 */
export abstract class BaseEntity {
  /**
   * The internal key. `bigint` because a marketplace's quote table is the kind of thing that
   * outgrows a 32-bit integer, and widening a primary key later means rewriting every foreign key
   * that points at it.
   *
   * ⚠️ TypeORM maps `bigint` to a JS **string**, not a number, and this surprises everyone once.
   * Postgres `bigint` goes up to 9.2×10¹⁸ while `Number.MAX_SAFE_INTEGER` is 9×10¹⁵, so returning
   * a number would silently lose precision on large ids. Compare these with `===` on strings, and
   * never do arithmetic on them.
   */
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string

  /**
   * The public identifier — the ONLY one this app ever serialises.
   *
   * ⚠️ Exposing the sequential `id` instead would leak the row count (a competitor can read how
   * many jobs the site has had off a single URL) and make every record trivially enumerable by
   * counting upward. The UUID costs 16 bytes and closes both.
   *
   * `@Generated('uuid')` puts the default in POSTGRES (`gen_random_uuid()`), not in the app, so a
   * row inserted by the seed script, by a migration or by hand in psql gets one too.
   */
  @Column({ type: 'uuid', unique: true, name: 'public_id' })
  @Generated('uuid')
  publicId: string

  /**
   * ⚠️ `timestamptz`, never `timestamp`. A bare `timestamp` stores no zone, so the same instant
   * written from a laptop in Austin and a server in UTC comes back as two different times — and
   * nothing in the database records which one was meant. `timestamptz` stores an instant.
   */
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date
}
