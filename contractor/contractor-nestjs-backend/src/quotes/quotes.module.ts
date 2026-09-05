import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { ContractorProfile } from '../database/entities/contractor-profile.entity.js'
import { Quote } from '../database/entities/quote.entity.js'
import { ProjectsModule } from '../projects/projects.module.js'
import { QuotesController } from './quotes.controller.js'
import { QuotesService } from './quotes.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([Quote, ContractorProfile]), ProjectsModule],
  controllers: [QuotesController],
  providers: [QuotesService],
})
export class QuotesModule {}
