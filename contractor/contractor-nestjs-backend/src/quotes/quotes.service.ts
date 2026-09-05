import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource, QueryFailedError } from 'typeorm'

import type { AuthenticatedUser } from '../auth/jwt-payload.js'
import { ProjectStatus, QuoteStatus } from '../common/enums.js'
import { toQuoteDto } from '../common/serializers.js'
import { ContractorProfile } from '../database/entities/contractor-profile.entity.js'
import { Project } from '../database/entities/project.entity.js'
import { Quote } from '../database/entities/quote.entity.js'
import { ProjectsService } from '../projects/projects.service.js'
import type { CreateQuoteDto } from './dto/quote.dto.js'

/** Postgres' error code for a unique-constraint violation. Worth naming — `'23505'` in a
 *  conditional is unreadable, and it is the one code this app deliberately catches. */
const PG_UNIQUE_VIOLATION = '23505'

@Injectable()
export class QuotesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly projectsService: ProjectsService,
  ) {}

  /** Rules 1 and 2, plus the one-quote-per-contractor constraint. */
  async create(user: AuthenticatedUser, dto: CreateQuoteDto) {
    if (!user.contractorId) {
      throw new ForbiddenException('Only contractors can quote on a project.')
    }

    // Rule 2, first half: the project must still be accepting quotes. Throws 404 otherwise.
    const project = await this.projectsService.findQuotableOrFail(dto.projectId)

    // Rule 1: a pro may only quote in a trade they actually work in. This is the same rule that
    // decides which leads they can SEE (a Hasura permission) — checked again here because a
    // permission that hides a row does not stop a request that names its id directly.
    const profile = await this.dataSource.getRepository(ContractorProfile).findOne({
      where: { id: user.contractorId },
      relations: { categories: true, user: true, portfolio: true },
    })
    if (!profile) throw new NotFoundException('Your contractor profile is missing.')

    const worksInTrade = profile.categories.some((category) => category.id === project.categoryId)
    if (!worksInTrade) {
      throw new ForbiddenException(
        `Add ${project.category.name} to your services before quoting on it.`,
      )
    }

    const quote = this.dataSource.getRepository(Quote).create({
      projectId: project.id,
      // ⚠️ From the token, never the body. A `contractorId` field in a request would let anyone
      // submit quotes in another pro's name.
      contractorId: user.contractorId,
      amount: dto.amount,
      estimatedDays: dto.estimatedDays,
      message: dto.message?.trim() ?? '',
      status: QuoteStatus.PENDING,
    })

    try {
      /**
       * The insert and the project's status bump are one transaction: the first quote moves a
       * project `open → quoted`, and a quote that exists on a project still showing `open` would
       * make the homeowner's dashboard say "no quotes yet" over a list containing one.
       */
      await this.dataSource.transaction(async (manager) => {
        await manager.save(quote)
        if (project.status === ProjectStatus.OPEN) {
          await manager.update(Project, { id: project.id }, { status: ProjectStatus.QUOTED })
        }
      })
    } catch (error) {
      /**
       * ⚠️ Catching the constraint instead of checking first, and that is the correct order.
       *
       * A `findOne` before the insert loses the race: two requests both see no existing quote,
       * both insert, and the database rejects one of them with a 500. Letting the constraint be
       * the check and translating its error is the only version with no window at all.
       */
      if (error instanceof QueryFailedError && (error.driverError as { code?: string })?.code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException('You have already quoted on this project.')
      }
      throw error
    }

    const saved = await this.dataSource.getRepository(Quote).findOneOrFail({
      where: { id: quote.id },
      relations: { project: true, contractor: { user: true, categories: true, portfolio: true } },
    })
    return toQuoteDto(saved)
  }
}
