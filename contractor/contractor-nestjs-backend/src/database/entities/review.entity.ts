import { Check, Column, Entity, Index, JoinColumn, ManyToOne, OneToOne } from 'typeorm'

import { BaseEntity } from './base.entity.js'
import { ContractorProfile } from './contractor-profile.entity.js'
import { Project } from './project.entity.js'
import { User } from './user.entity.js'

/**
 * A homeowner's rating of a completed job.
 *
 * ⚠️ `project_id` is UNIQUE — one review per project, forever. `ReviewsService` checks first and
 * returns a clean 409, but the constraint is what actually holds when two requests race.
 *
 * ⚠️ The CHECK on `rating` duplicates the `@Min(1) @Max(5)` on the DTO, deliberately. The DTO
 * protects the API; the constraint protects the TABLE, which is also written by the seed script
 * and by anyone in psql. A rating of 7 in this table would corrupt every contractor's average
 * with no way to tell which row did it.
 */
@Entity('reviews')
@Check('ck_review_rating_range', '"rating" >= 1 AND "rating" <= 5')
@Index(['contractorId', 'createdAt'])
export class Review extends BaseEntity {
  @OneToOne(() => Project, (project) => project.review, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'project_id' })
  project: Project

  @Column({ type: 'bigint', name: 'project_id', unique: true })
  projectId: string

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'homeowner_id' })
  homeowner: User

  @Column({ type: 'bigint', name: 'homeowner_id' })
  homeownerId: string

  /**
   * Who is being reviewed. Denormalised from `project → accepted quote → contractor` on purpose:
   * a contractor's public profile lists their reviews, and walking two joins to answer "reviews
   * for this pro" is both slower and fragile — the accepted quote could in principle be changed,
   * and a review must stay attached to whoever actually did the work.
   */
  @ManyToOne(() => ContractorProfile, (profile) => profile.reviews, { nullable: false })
  @JoinColumn({ name: 'contractor_profile_id' })
  contractor: ContractorProfile

  @Column({ type: 'bigint', name: 'contractor_profile_id' })
  contractorId: string

  /**
   * ⚠️ A COPY of the project's title, taken when the review is written.
   *
   * The public profile lists reviews to anonymous visitors, and `projects` is not readable by
   * `anonymous` — a project row carries the homeowner's address and budget. Following
   * `review.project.title` therefore fails with "field 'project' not found in type: 'reviews'".
   *
   * It is also the more correct model: a review describes the job as it was. Renaming a project
   * deliberately does not rename it here.
   */
  @Column({ type: 'varchar', length: 160, name: 'project_title' })
  projectTitle: string

  @Column({ type: 'int' })
  rating: number

  @Column({ type: 'text', default: '' })
  comment: string
}
