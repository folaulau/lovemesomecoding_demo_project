import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { ContractorProfile } from '../database/entities/contractor-profile.entity.js'
import { PortfolioImage } from '../database/entities/portfolio-image.entity.js'
import { ServiceCategory } from '../database/entities/service-category.entity.js'
import { ContractorsController } from './contractors.controller.js'
import { ContractorsService } from './contractors.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([ContractorProfile, PortfolioImage, ServiceCategory])],
  controllers: [ContractorsController],
  providers: [ContractorsService],
})
export class ContractorsModule {}
