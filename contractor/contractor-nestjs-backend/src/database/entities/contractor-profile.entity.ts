import { Column, Entity, JoinColumn, JoinTable, ManyToMany, OneToMany, OneToOne } from 'typeorm'

import { BaseEntity } from './base.entity.js'
import type { PortfolioImage } from './portfolio-image.entity.js'
import type { Quote } from './quote.entity.js'
import type { Review } from './review.entity.js'
import { ServiceCategory } from './service-category.entity.js'
import { User } from './user.entity.js'

/** Everything about a contractor that a homeowner account has no use for. */
@Entity('contractor_profiles')
export class ContractorProfile extends BaseEntity {
  @OneToOne(() => User, (user) => user.contractorProfile, {
    // The profile is meaningless without its user, and a user row is never hard-deleted (see the
    // `deleted` flag), so the cascade can never actually fire in this app. It is here to say what
    // the relationship means rather than to be relied on.
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'user_id' })
  user: User

  /**
   * ⚠️ The raw foreign key, alongside the relation.
   *
   * TypeORM populates this from the same column, and having it means a service can filter by
   * `{ user: { id } }`'s cheaper equivalent `{ userId }` without loading the `User` at all. The
   * cost is that the two can be set inconsistently in the same object — always assign the
   * relation, and treat this as read-only.
   */
  @Column({ type: 'bigint', name: 'user_id' })
  userId: string

  @Column({ type: 'varchar', length: 160, name: 'business_name' })
  businessName: string

  /** `text`, not `varchar(n)`. In Postgres they perform identically, and a length cap on free
   *  prose only ever produces a truncated bio and a support ticket. */
  @Column({ type: 'text', default: '' })
  bio: string

  @Column({ type: 'int', default: 0, name: 'years_in_business' })
  yearsInBusiness: number

  @Column({ type: 'varchar', length: 60, nullable: true, name: 'license_number' })
  licenseNumber: string | null

  @Column({ type: 'varchar', length: 100, default: '' })
  city: string

  @Column({ type: 'varchar', length: 2, default: '' })
  state: string

  @Column({ type: 'varchar', length: 10, default: '' })
  zip: string

  @Column({ type: 'int', default: 25, name: 'service_radius_miles' })
  serviceRadiusMiles: number

  /**
   * ⚠️ `numeric(10,2)`, never `float`/`double`, for anything that is money.
   *
   * Binary floating point cannot represent 0.1 exactly, so `0.1 + 0.2 === 0.30000000000000004`.
   * That is a rounding error in a chart and a wrong invoice in a marketplace. `numeric` is exact
   * decimal arithmetic.
   *
   * ⚠️ The trade-off: pg returns `numeric` as a STRING, for the same precision reason `bigint` is
   * a string. The transformer below converts it at the boundary, so services and DTOs see numbers
   * and only this file knows about it.
   */
  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    name: 'hourly_rate_min',
    transformer: {
      to: (value: number) => value,
      from: (value: string | null) => (value === null ? 0 : Number(value)),
    },
  })
  hourlyRateMin: number

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    name: 'hourly_rate_max',
    transformer: {
      to: (value: number) => value,
      from: (value: string | null) => (value === null ? 0 : Number(value)),
    },
  })
  hourlyRateMax: number

  /**
   * ⚠️ CACHED aggregates. Both are recomputed from the `reviews` rows by
   * `ReviewsService.recomputeRating`, inside the same transaction that writes the review.
   *
   * They exist because the contractor directory sorts and filters on rating, and doing that with
   * a correlated subquery over every profile is the query that gets slow first. They are NEVER
   * accepted from a request body — a pro who could PATCH their own rating is the first thing
   * anybody would try — and never incremented in place, because one failed write then leaves a
   * number that no longer matches the reviews underneath it.
   */
  @Column({
    type: 'numeric',
    precision: 3,
    scale: 2,
    default: 0,
    name: 'rating_average',
    transformer: {
      to: (value: number) => value,
      from: (value: string | null) => (value === null ? 0 : Number(value)),
    },
  })
  ratingAverage: number

  @Column({ type: 'int', default: 0, name: 'review_count' })
  reviewCount: number

  @Column({ type: 'boolean', default: false })
  deleted: boolean

  /**
   * The trades this pro works in — and therefore the leads they are allowed to see at all.
   *
   * `@JoinTable` goes on exactly ONE side of a many-to-many; it is the side that owns the join
   * table. Put it on both and TypeORM creates two tables and neither relation works.
   */
  @ManyToMany(() => ServiceCategory, (category) => category.contractors)
  @JoinTable({
    name: 'contractor_services',
    joinColumn: { name: 'contractor_profile_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'service_category_id', referencedColumnName: 'id' },
  })
  categories: ServiceCategory[]

  @OneToMany('PortfolioImage', (image: PortfolioImage) => image.contractor)
  portfolio: PortfolioImage[]

  @OneToMany('Quote', (quote: Quote) => quote.contractor)
  quotes: Quote[]

  @OneToMany('Review', (review: Review) => review.contractor)
  reviews: Review[]
}
