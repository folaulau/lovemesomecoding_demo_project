import { Body, Controller, Post, UseGuards } from '@nestjs/common'

import type { AuthenticatedUser } from '../auth/jwt-payload.js'
import { CurrentUser } from '../common/decorators/current-user.decorator.js'
import { Roles } from '../common/decorators/roles.decorator.js'
import { UserRole } from '../common/enums.js'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js'
import { RolesGuard } from '../common/guards/roles.guard.js'
import { CreateReviewDto } from './dto/review.dto.js'
import { ReviewsService } from './reviews.service.js'

@Controller('api/v1/reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @Roles(UserRole.HOMEOWNER)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(user, dto)
  }
}
