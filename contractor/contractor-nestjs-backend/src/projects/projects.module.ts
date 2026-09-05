import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { Project } from '../database/entities/project.entity.js'
import { Quote } from '../database/entities/quote.entity.js'
import { ServiceCategory } from '../database/entities/service-category.entity.js'
import { ProjectsController } from './projects.controller.js'
import { ProjectsService } from './projects.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([Project, Quote, ServiceCategory])],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  // QuotesService asks this one whether a project still accepts bids, so the rule lives in one
  // place rather than being re-implemented against the same columns.
  exports: [ProjectsService],
})
export class ProjectsModule {}
