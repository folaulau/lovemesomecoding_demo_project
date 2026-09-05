import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, OneToOne } from 'typeorm'

import { ProjectStatus } from '../../common/enums.js'
import { BaseEntity } from './base.entity.js'
import type { Quote } from './quote.entity.js'
import type { Review } from './review.entity.js'
import { ServiceCategory } from './service-category.entity.js'
import { User } from './user.entity.js'

/**
 * A job a homeowner wants done.
 *
 * ⚠️ `status` is the spine of this app. Every rule in `progress_report.md` is ultimately a
 * statement about which transitions are legal and who may make them, and every one of those checks
 * lives in `ProjectsService` — never in a controller, and never in Hasura, which has no
 * insert/update/delete permission on this table for any role.
 */
@Entity('projects')
// The lead feed asks "open projects in these categories, newest first" on every page load, and
// this composite index is exactly that query. Column order matters: the equality columns come
// first, the sort column last.
@Index(['status', 'categoryId', 'createdAt'])
export class Project extends BaseEntity {
  @ManyToOne(() => User, (user) => user.projects, { nullable: false })
  @JoinColumn({ name: 'homeowner_id' })
  homeowner: User

  @Column({ type: 'bigint', name: 'homeowner_id' })
  homeownerId: string

  @ManyToOne(() => ServiceCategory, (category) => category.projects, { nullable: false })
  @JoinColumn({ name: 'service_category_id' })
  category: ServiceCategory

  @Column({ type: 'bigint', name: 'service_category_id' })
  categoryId: string

  @Column({ type: 'varchar', length: 160 })
  title: string

  @Column({ type: 'text' })
  description: string

  @Column({ type: 'varchar', length: 100 })
  city: string

  @Column({ type: 'varchar', length: 2 })
  state: string

  @Column({ type: 'varchar', length: 10 })
  zip: string

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'budget_min',
    transformer: { to: (v: number) => v, from: (v: string | null) => (v === null ? 0 : Number(v)) },
  })
  budgetMin: number

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'budget_max',
    transformer: { to: (v: number) => v, from: (v: string | null) => (v === null ? 0 : Number(v)) },
  })
  budgetMax: number

  /**
   * ⚠️ `date`, not `timestamptz`. The homeowner picks a DAY, and a day is not an instant — storing
   * it as a timestamp forces a time and a zone onto a value that has neither, which is how
   * "September 10th" becomes "September 9th" for everyone west of the server.
   *
   * pg returns a `date` column as a `YYYY-MM-DD` string, which is exactly what the API should
   * serialise, so there is no transformer here on purpose.
   */
  @Column({ type: 'date', name: 'preferred_start_date' })
  preferredStartDate: string

  @Column({ type: 'varchar', length: 20, default: ProjectStatus.OPEN })
  status: ProjectStatus

  @OneToMany('Quote', (quote: Quote) => quote.project)
  quotes: Quote[]

  @OneToOne('Review', (review: Review) => review.project)
  review: Review | null
}
