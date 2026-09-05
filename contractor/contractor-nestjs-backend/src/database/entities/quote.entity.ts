import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm'

import { QuoteStatus } from '../../common/enums.js'
import { BaseEntity } from './base.entity.js'
import { ContractorProfile } from './contractor-profile.entity.js'
import { Project } from './project.entity.js'

/**
 * One contractor's bid on one project.
 *
 * ⚠️ The unique constraint is a real rule, not a tidiness measure: one quote per contractor per
 * project. `QuotesService` checks for an existing quote before inserting, and this constraint is
 * what makes that check trustworthy — two requests arriving at the same instant both pass the
 * check, and only the database can stop the second insert. Application-level uniqueness checks are
 * always a race; the constraint is the actual guarantee.
 */
@Entity('quotes')
@Unique('uq_quote_per_contractor_per_project', ['projectId', 'contractorId'])
@Index(['contractorId', 'createdAt'])
export class Quote extends BaseEntity {
  @ManyToOne(() => Project, (project) => project.quotes, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'project_id' })
  project: Project

  @Column({ type: 'bigint', name: 'project_id' })
  projectId: string

  @ManyToOne(() => ContractorProfile, (profile) => profile.quotes, { nullable: false })
  @JoinColumn({ name: 'contractor_profile_id' })
  contractor: ContractorProfile

  @Column({ type: 'bigint', name: 'contractor_profile_id' })
  contractorId: string

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: { to: (v: number) => v, from: (v: string | null) => (v === null ? 0 : Number(v)) },
  })
  amount: number

  @Column({ type: 'int', name: 'estimated_days' })
  estimatedDays: number

  @Column({ type: 'text', default: '' })
  message: string

  @Column({ type: 'varchar', length: 20, default: QuoteStatus.PENDING })
  status: QuoteStatus
}
