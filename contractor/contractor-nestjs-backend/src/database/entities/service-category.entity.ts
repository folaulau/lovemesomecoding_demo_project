import { Column, Entity, Index, ManyToMany, OneToMany } from 'typeorm'

import { BaseEntity } from './base.entity.js'
import type { ContractorProfile } from './contractor-profile.entity.js'
import type { Project } from './project.entity.js'

/** A trade: Plumbing, Electrical, Roofing… Seeded, and never edited through the API. */
@Entity('service_categories')
export class ServiceCategory extends BaseEntity {
  /** The URL-safe name. The directory filters on `?category=plumbing`, so this is effectively a
   *  public identifier and changing one breaks every link anyone has shared. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 60 })
  slug: string

  @Column({ type: 'varchar', length: 80 })
  name: string

  @Column({ type: 'varchar', length: 300 })
  description: string

  /** A single emoji. `varchar(8)` rather than `char(1)`: many emoji are several code points —
   *  ❄️ is a snowflake plus a variation selector — and a one-character column truncates them into
   *  a different glyph. */
  @Column({ type: 'varchar', length: 8 })
  icon: string

  @ManyToMany('ContractorProfile', (profile: ContractorProfile) => profile.categories)
  contractors: ContractorProfile[]

  @OneToMany('Project', (project: Project) => project.category)
  projects: Project[]
}
