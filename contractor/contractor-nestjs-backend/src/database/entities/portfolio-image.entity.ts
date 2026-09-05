import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm'

import { BaseEntity } from './base.entity.js'
import { ContractorProfile } from './contractor-profile.entity.js'

/** One uploaded photo of finished work. */
@Entity('portfolio_images')
@Index(['contractorId', 'sortOrder'])
export class PortfolioImage extends BaseEntity {
  @ManyToOne(() => ContractorProfile, (profile) => profile.portfolio, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'contractor_profile_id' })
  contractor: ContractorProfile

  @Column({ type: 'bigint', name: 'contractor_profile_id' })
  contractorId: string

  /**
   * ⚠️ A relative path (`/uploads/a1b2….jpg`), not an absolute URL.
   *
   * Storing `http://localhost:3001/uploads/…` bakes today's host into every row, and the day the
   * app moves behind a domain every image 404s with no migration to fix it. The frontend prefixes
   * its API base; the database stores the part that never changes.
   */
  @Column({ type: 'varchar', length: 500 })
  url: string

  @Column({ type: 'varchar', length: 200, nullable: true })
  caption: string | null

  /** Position in the gallery. Image 0 is the cover shown on the directory card. */
  @Column({ type: 'int', default: 0, name: 'sort_order' })
  sortOrder: number
}
