import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { ContractorProfile } from '../database/entities/contractor-profile.entity.js'
import { Project } from '../database/entities/project.entity.js'
import { Quote } from '../database/entities/quote.entity.js'
import { Review } from '../database/entities/review.entity.js'
import { ReviewsController } from './reviews.controller.js'
import { ReviewsService } from './reviews.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([Review, Project, Quote, ContractorProfile])],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
