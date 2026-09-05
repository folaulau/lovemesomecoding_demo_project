import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource, In, Not } from 'typeorm'
import type { EntityManager } from 'typeorm'

import { ProjectStatus, QUOTABLE_STATUSES, QuoteStatus } from '../common/enums.js'
import type { ProjectStatus as ProjectStatusType } from '../common/enums.js'
import { toProjectDto } from '../common/serializers.js'
import { Project } from '../database/entities/project.entity.js'
import { Quote } from '../database/entities/quote.entity.js'
import { ServiceCategory } from '../database/entities/service-category.entity.js'
import type { AuthenticatedUser } from '../auth/jwt-payload.js'
import type { CreateProjectDto } from './dto/project.dto.js'
import { CANCELLABLE_BY_HOMEOWNER } from './dto/project.dto.js'

/**
 * Which state changes exist, and who owns each one.
 *
 * ⚠️ An ALLOWLIST, not a list of forbidden moves. A status added later is closed by default and
 * has to be opened deliberately — with a denylist it would be open by accident, and nothing would
 * point that out.
 */
const TRANSITIONS: Array<{
  from: ProjectStatusType
  to: ProjectStatusType
  by: 'homeowner' | 'hired-contractor'
}> = [
  { from: ProjectStatus.HIRED, to: ProjectStatus.IN_PROGRESS, by: 'hired-contractor' },
  { from: ProjectStatus.IN_PROGRESS, to: ProjectStatus.COMPLETED, by: 'hired-contractor' },
  { from: ProjectStatus.OPEN, to: ProjectStatus.CANCELLED, by: 'homeowner' },
  { from: ProjectStatus.QUOTED, to: ProjectStatus.CANCELLED, by: 'homeowner' },
]

/** Everything a serialised project needs loaded. Named once so no route can forget half of it. */
const FULL_RELATIONS = {
  homeowner: true,
  category: true,
  review: { homeowner: true },
  quotes: { contractor: { user: true, categories: true, portfolio: true } },
} as const

@Injectable()
export class ProjectsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async create(user: AuthenticatedUser, dto: CreateProjectDto) {
    if (dto.budgetMax < dto.budgetMin) {
      throw new BadRequestException('The top of the budget cannot be below the bottom of it.')
    }

    const category = await this.dataSource
      .getRepository(ServiceCategory)
      .findOne({ where: { publicId: dto.categoryId } })
    if (!category) throw new BadRequestException('Pick a service category.')

    const repo = this.dataSource.getRepository(Project)
    const project = repo.create({
      // ⚠️ The homeowner comes from the VERIFIED TOKEN, never from the body. A `homeownerId` field
      // in a request would let anyone post a project as somebody else — and on this app that is
      // enough to then read the quotes it attracts.
      homeownerId: user.id,
      categoryId: category.id,
      title: dto.title.trim(),
      description: dto.description.trim(),
      city: dto.city.trim(),
      state: dto.state.trim().toUpperCase(),
      zip: dto.zip.trim(),
      budgetMin: dto.budgetMin,
      budgetMax: dto.budgetMax,
      // Already `YYYY-MM-DD`; the column is a `date` and wants exactly that.
      preferredStartDate: dto.preferredStartDate.slice(0, 10),
      status: ProjectStatus.OPEN,
    })

    const saved = await repo.save(project)
    return toProjectDto(await this.loadOrFail(saved.publicId))
  }

  /**
   * Rule 4, and the reason writes do not go through Hasura.
   *
   * Accepting one quote must ALSO decline every other pending quote and hire the project. If any
   * part of that fails, none of it may land: halfway through, the project is `hired` with two
   * `pending` quotes on it, and a homeowner refreshing at that instant sees two pros they can both
   * still accept. One transaction is what makes the three writes a single fact.
   */
  async acceptQuote(user: AuthenticatedUser, projectPublicId: string, quotePublicId: string) {
    await this.dataSource.transaction(async (manager) => {
      /**
       * ⚠️ `SELECT … FOR UPDATE` via `lock: { mode: 'pessimistic_write' }`.
       *
       * Two accepts arriving together would otherwise both read a `quoted` project, both pass the
       * status check, and both write — leaving two accepted quotes. The row lock makes the second
       * transaction wait until the first commits, at which point it re-reads a `hired` project and
       * fails the check properly. The partial unique index on `quotes` is the backstop if this is
       * ever removed.
       */
      const project = await manager.findOne(Project, {
        where: { publicId: projectPublicId },
        lock: { mode: 'pessimistic_write' },
      })

      // ⚠️ 404 for someone else's project, not 403. A 403 confirms the id exists, which turns a
      // guessable identifier into a slow enumeration of every job on the site.
      if (!project || project.homeownerId !== user.id) {
        throw new NotFoundException('That project no longer exists.')
      }
      if (!QUOTABLE_STATUSES.includes(project.status)) {
        throw new ConflictException('You have already hired someone for this project.')
      }

      const winner = await manager.findOne(Quote, {
        where: { publicId: quotePublicId, projectId: project.id },
      })
      if (!winner) throw new NotFoundException('That quote no longer exists.')
      if (winner.status !== QuoteStatus.PENDING) {
        throw new ConflictException('That quote is no longer available.')
      }

      // Decline the others FIRST. If the order were reversed, the partial unique index
      // `uq_one_accepted_quote_per_project` would still hold — but doing the wide update before
      // the narrow one keeps the losing rows from being briefly visible alongside a winner.
      await manager.update(
        Quote,
        { projectId: project.id, status: QuoteStatus.PENDING, publicId: Not(winner.publicId) },
        { status: QuoteStatus.DECLINED },
      )
      await manager.update(Quote, { id: winner.id }, { status: QuoteStatus.ACCEPTED })
      await manager.update(Project, { id: project.id }, { status: ProjectStatus.HIRED })
    })

    return toProjectDto(await this.loadOrFail(projectPublicId))
  }

  /**
   * Rule 5. `hired → in_progress → completed` belongs to the contractor who actually won the job;
   * cancelling belongs to the homeowner, and only before anyone is hired.
   */
  async updateStatus(user: AuthenticatedUser, projectPublicId: string, next: ProjectStatusType) {
    await this.dataSource.transaction(async (manager: EntityManager) => {
      const project = await manager.findOne(Project, {
        where: { publicId: projectPublicId },
        lock: { mode: 'pessimistic_write' },
      })
      if (!project) throw new NotFoundException('That project no longer exists.')

      const move = TRANSITIONS.find((t) => t.from === project.status && t.to === next)
      if (!move) {
        throw new ConflictException(`A ${project.status} project cannot move to ${next}.`)
      }

      if (move.by === 'homeowner') {
        if (project.homeownerId !== user.id) {
          throw new NotFoundException('That project no longer exists.')
        }
        if (!CANCELLABLE_BY_HOMEOWNER.includes(project.status)) {
          throw new ConflictException('This project can no longer be cancelled.')
        }
      } else {
        // ⚠️ "The hired contractor" is defined by the ACCEPTED QUOTE, not by anything on the
        // project row. There is no `hired_contractor_id` column on purpose — it would be a second
        // copy of a fact the quotes already record, and the two would eventually disagree.
        const accepted = await manager.findOne(Quote, {
          where: { projectId: project.id, status: QuoteStatus.ACCEPTED },
        })
        if (!accepted || accepted.contractorId !== user.contractorId) {
          throw new NotFoundException('That project no longer exists.')
        }
      }

      await manager.update(Project, { id: project.id }, { status: next })
    })

    return toProjectDto(await this.loadOrFail(projectPublicId))
  }

  /** Loads a project with everything the serialiser needs, or throws. */
  private async loadOrFail(publicId: string): Promise<Project> {
    const project = await this.dataSource.getRepository(Project).findOne({
      where: { publicId },
      relations: FULL_RELATIONS,
      // ⚠️ Without this, the quotes come back in whatever order Postgres felt like, which for a
      // small table is usually insertion order and therefore looks correct in development right
      // up until it does not. An ORDER BY is the only thing that makes a list ordered.
      order: { quotes: { createdAt: 'ASC' } },
    })
    if (!project) throw new NotFoundException('That project no longer exists.')
    return project
  }

  /** Used by QuotesService to decide whether a project still accepts bids. */
  async findQuotableOrFail(publicId: string): Promise<Project> {
    const project = await this.dataSource
      .getRepository(Project)
      .findOne({ where: { publicId, status: In(QUOTABLE_STATUSES) }, relations: { category: true } })
    if (!project) {
      throw new NotFoundException('That project is not accepting quotes.')
    }
    return project
  }
}
