var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';
import { ProjectStatus, QuoteStatus } from '../common/enums.js';
import { toQuoteDto } from '../common/serializers.js';
import { ContractorProfile } from '../database/entities/contractor-profile.entity.js';
import { Project } from '../database/entities/project.entity.js';
import { Quote } from '../database/entities/quote.entity.js';
import { ProjectsService } from '../projects/projects.service.js';
const PG_UNIQUE_VIOLATION = '23505';
let QuotesService = class QuotesService {
    dataSource;
    projectsService;
    constructor(dataSource, projectsService) {
        this.dataSource = dataSource;
        this.projectsService = projectsService;
    }
    async create(user, dto) {
        if (!user.contractorId) {
            throw new ForbiddenException('Only contractors can quote on a project.');
        }
        const project = await this.projectsService.findQuotableOrFail(dto.projectId);
        const profile = await this.dataSource.getRepository(ContractorProfile).findOne({
            where: { id: user.contractorId },
            relations: { categories: true, user: true, portfolio: true },
        });
        if (!profile)
            throw new NotFoundException('Your contractor profile is missing.');
        const worksInTrade = profile.categories.some((category) => category.id === project.categoryId);
        if (!worksInTrade) {
            throw new ForbiddenException(`Add ${project.category.name} to your services before quoting on it.`);
        }
        const quote = this.dataSource.getRepository(Quote).create({
            projectId: project.id,
            contractorId: user.contractorId,
            amount: dto.amount,
            estimatedDays: dto.estimatedDays,
            message: dto.message?.trim() ?? '',
            status: QuoteStatus.PENDING,
        });
        try {
            await this.dataSource.transaction(async (manager) => {
                await manager.save(quote);
                if (project.status === ProjectStatus.OPEN) {
                    await manager.update(Project, { id: project.id }, { status: ProjectStatus.QUOTED });
                }
            });
        }
        catch (error) {
            if (error instanceof QueryFailedError && error.driverError?.code === PG_UNIQUE_VIOLATION) {
                throw new ConflictException('You have already quoted on this project.');
            }
            throw error;
        }
        const saved = await this.dataSource.getRepository(Quote).findOneOrFail({
            where: { id: quote.id },
            relations: { project: true, contractor: { user: true, categories: true, portfolio: true } },
        });
        return toQuoteDto(saved);
    }
};
QuotesService = __decorate([
    Injectable(),
    __param(0, InjectDataSource()),
    __metadata("design:paramtypes", [DataSource,
        ProjectsService])
], QuotesService);
export { QuotesService };
//# sourceMappingURL=quotes.service.js.map