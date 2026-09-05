import { Body, Controller, Post, UseGuards } from '@nestjs/common'

import type { AuthenticatedUser } from '../auth/jwt-payload.js'
import { CurrentUser } from '../common/decorators/current-user.decorator.js'
import { Roles } from '../common/decorators/roles.decorator.js'
import { UserRole } from '../common/enums.js'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js'
import { RolesGuard } from '../common/guards/roles.guard.js'
import { CreateQuoteDto } from './dto/quote.dto.js'
import { QuotesService } from './quotes.service.js'

@Controller('api/v1/quotes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Post()
  @Roles(UserRole.CONTRACTOR)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateQuoteDto) {
    return this.quotesService.create(user, dto)
  }
}
