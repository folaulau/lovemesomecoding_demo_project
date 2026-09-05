import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import type { EntityManager } from 'typeorm'

import type { AuthenticatedUser } from '../auth/jwt-payload.js'
import { ProjectStatus, QuoteStatus } from '../common/enums.js'
import { toReviewDto } from '../common/serializers.js'
import { ContractorProfile } from '../database/entities/contractor-profile.entity.js'
import { Project } from '../database/entities/project.entity.js'
import { Quote } from '../database/entities/quote.entity.js'
import { Review } from '../database/entities/review.entity.js'
import type { CreateReviewDto } from './dto/review.dto.js'

@Injectable()
export class ReviewsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Rules 6 and 7: who may review, when, how often — and the rating recompute that follows. */
  async create(user: AuthenticatedUser, dto: CreateReviewDto) {
    const reviewId = await this.dataSource.transaction(async (manager) => {
      const project = await manager.findOne(Project, { where: { publicId: dto.projectId } })

      // 404 rather than 403 for someone else's project — the same reasoning as everywhere else in
      // this app: a 403 confirms the id is real.
      if (!project || project.homeownerId !== user.id) {
        throw new NotFoundException('That project no longer exists.')
      }
      if (project.status !== ProjectStatus.COMPLETED) {
        throw new ConflictException('You can leave a review once the work is marked complete.')
      }

      const existing = await manager.findOne(Review, { where: { projectId: project.id } })
      if (existing) throw new ConflictException('You have already reviewed this project.')

      // Who is being reviewed is derived from the accepted quote, not sent by the client. A
      // `contractorId` in the body would let a homeowner attach a one-star review to any pro on
      // the site.
      const accepted = await manager.findOne(Quote, {
        where: { projectId: project.id, status: QuoteStatus.ACCEPTED },
      })
      if (!accepted) {
        throw new ConflictException('This project never had a contractor hired on it.')
      }

      const review = manager.create(Review, {
        projectId: project.id,
        // Snapshot of the title at review time — see the column's note in review.entity.ts.
        projectTitle: project.title,
        homeownerId: user.id,
        contractorId: accepted.contractorId,
        rating: dto.rating,
        comment: dto.comment?.trim() ?? '',
      })
      await manager.save(review)

      // ⚠️ Inside the SAME transaction as the insert. Recomputing afterwards would leave a window
      // where the review row exists and the average does not include it — and if the second write
      // failed, permanently.
      await this.recomputeRating(manager, accepted.contractorId)

      return review.id
    })

    const saved = await this.dataSource.getRepository(Review).findOneOrFail({
      where: { id: reviewId },
      relations: { project: true, homeowner: true },
    })
    return toReviewDto(saved)
  }

  /**
   * Rule 7. The cached rating is DERIVED, always, from the review rows.
   *
   * ⚠️ Never `review_count = review_count + 1`. An incremental update is one failed write away
   * from a number that no longer matches the reviews underneath it, with nothing to detect the
   * drift — and on a marketplace that number is the product. Recomputing is a single aggregate
   * over an indexed column; it is not the query that will ever be too slow.
   */
  private async recomputeRating(manager: EntityManager, contractorId: string): Promise<void> {
    const result = await manager
      .createQueryBuilder(Review, 'review')
      .select('COUNT(*)', 'count')
      // COALESCE because AVG over zero rows is NULL, not 0 — and NULL would be written straight
      // into a NOT NULL column. Rounded to 2dp to match numeric(3,2).
      .addSelect('COALESCE(ROUND(AVG(review.rating), 2), 0)', 'average')
      .where('review.contractor_profile_id = :contractorId', { contractorId })
      .getRawOne<{ count: string; average: string }>()

    await manager.update(
      ContractorProfile,
      { id: contractorId },
      {
        reviewCount: Number(result?.count ?? 0),
        ratingAverage: Number(result?.average ?? 0),
      },
    )
  }
}
