import { Body, Controller, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common'

import type { AuthenticatedUser } from '../auth/jwt-payload.js'
import { CurrentUser } from '../common/decorators/current-user.decorator.js'
import { Roles } from '../common/decorators/roles.decorator.js'
import { UserRole } from '../common/enums.js'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js'
import { RolesGuard } from '../common/guards/roles.guard.js'
import { AcceptQuoteDto, CreateProjectDto, UpdateProjectStatusDto } from './dto/project.dto.js'
import { ProjectsService } from './projects.service.js'

/**
 * ⚠️ Writes only. Reading projects is Hasura's job — see the permissions in `hasura/metadata`.
 * Adding a `@Get()` here would be the start of two ways to read the same rows with two different
 * sets of rules, and the second one is always the one that leaks.
 *
 * ⚠️ Guard order matters: `RolesGuard` reads the user that `JwtAuthGuard` attaches, and Nest runs
 * them left to right. Swapped, every request is a 403.
 */
@Controller('api/v1/projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @Roles(UserRole.HOMEOWNER)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(user, dto)
  }

  /**
   * `ParseUUIDPipe` rejects a non-UUID before the service runs a query with it. Without it,
   * `/projects/1/accept-quote` reaches the database as a perfectly valid string comparison that
   * finds nothing — a 404 that looks identical to "someone else's project", which makes debugging
   * a real 404 unnecessarily hard.
   */
  @Post(':projectId/accept-quote')
  @Roles(UserRole.HOMEOWNER)
  acceptQuote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: AcceptQuoteDto,
  ) {
    return this.projectsService.acceptQuote(user, projectId, dto.quoteId)
  }

  /**
   * One endpoint for every status move, rather than /start, /complete and /cancel.
   *
   * The alternative reads more nicely and duplicates the transition table across three handlers.
   * With one endpoint, `TRANSITIONS` in the service is the only description of the lifecycle that
   * exists — which is what makes it possible to trust it.
   *
   * No `@Roles` here on purpose: BOTH roles use it, and which one may make a given move depends on
   * the project's current status. That check belongs in the service, which can see the row.
   */
  @Patch(':projectId/status')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: UpdateProjectStatusDto,
  ) {
    return this.projectsService.updateStatus(user, projectId, dto.status)
  }
}
