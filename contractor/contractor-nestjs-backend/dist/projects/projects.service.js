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
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, Not } from 'typeorm';
import { ProjectStatus, QUOTABLE_STATUSES, QuoteStatus } from '../common/enums.js';
import { toProjectDto } from '../common/serializers.js';
import { Project } from '../database/entities/project.entity.js';
import { Quote } from '../database/entities/quote.entity.js';
import { ServiceCategory } from '../database/entities/service-category.entity.js';
import { CANCELLABLE_BY_HOMEOWNER } from './dto/project.dto.js';
const TRANSITIONS = [
    { from: ProjectStatus.HIRED, to: ProjectStatus.IN_PROGRESS, by: 'hired-contractor' },
    { from: ProjectStatus.IN_PROGRESS, to: ProjectStatus.COMPLETED, by: 'hired-contractor' },
    { from: ProjectStatus.OPEN, to: ProjectStatus.CANCELLED, by: 'homeowner' },
    { from: ProjectStatus.QUOTED, to: ProjectStatus.CANCELLED, by: 'homeowner' },
];
const FULL_RELATIONS = {
    homeowner: true,
    category: true,
    review: { homeowner: true },
    quotes: { contractor: { user: true, categories: true, portfolio: true } },
};
let ProjectsService = class ProjectsService {
    dataSource;
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    async create(user, dto) {
        if (dto.budgetMax < dto.budgetMin) {
            throw new BadRequestException('The top of the budget cannot be below the bottom of it.');
        }
        const category = await this.dataSource
            .getRepository(ServiceCategory)
            .findOne({ where: { publicId: dto.categoryId } });
        if (!category)
            throw new BadRequestException('Pick a service category.');
        const repo = this.dataSource.getRepository(Project);
        const project = repo.create({
            homeownerId: user.id,
            categoryId: category.id,
            title: dto.title.trim(),
            description: dto.description.trim(),
            city: dto.city.trim(),
            state: dto.state.trim().toUpperCase(),
            zip: dto.zip.trim(),
            budgetMin: dto.budgetMin,
            budgetMax: dto.budgetMax,
            preferredStartDate: dto.preferredStartDate.slice(0, 10),
            status: ProjectStatus.OPEN,
        });
        const saved = await repo.save(project);
        return toProjectDto(await this.loadOrFail(saved.publicId));
    }
    async acceptQuote(user, projectPublicId, quotePublicId) {
        await this.dataSource.transaction(async (manager) => {
            const project = await manager.findOne(Project, {
                where: { publicId: projectPublicId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!project || project.homeownerId !== user.id) {
                throw new NotFoundException('That project no longer exists.');
            }
            if (!QUOTABLE_STATUSES.includes(project.status)) {
                throw new ConflictException('You have already hired someone for this project.');
            }
            const winner = await manager.findOne(Quote, {
                where: { publicId: quotePublicId, projectId: project.id },
            });
            if (!winner)
                throw new NotFoundException('That quote no longer exists.');
            if (winner.status !== QuoteStatus.PENDING) {
                throw new ConflictException('That quote is no longer available.');
            }
            await manager.update(Quote, { projectId: project.id, status: QuoteStatus.PENDING, publicId: Not(winner.publicId) }, { status: QuoteStatus.DECLINED });
            await manager.update(Quote, { id: winner.id }, { status: QuoteStatus.ACCEPTED });
            await manager.update(Project, { id: project.id }, { status: ProjectStatus.HIRED });
        });
        return toProjectDto(await this.loadOrFail(projectPublicId));
    }
    async updateStatus(user, projectPublicId, next) {
        await this.dataSource.transaction(async (manager) => {
            const project = await manager.findOne(Project, {
                where: { publicId: projectPublicId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!project)
                throw new NotFoundException('That project no longer exists.');
            const move = TRANSITIONS.find((t) => t.from === project.status && t.to === next);
            if (!move) {
                throw new ConflictException(`A ${project.status} project cannot move to ${next}.`);
            }
            if (move.by === 'homeowner') {
                if (project.homeownerId !== user.id) {
                    throw new NotFoundException('That project no longer exists.');
                }
                if (!CANCELLABLE_BY_HOMEOWNER.includes(project.status)) {
                    throw new ConflictException('This project can no longer be cancelled.');
                }
            }
            else {
                const accepted = await manager.findOne(Quote, {
                    where: { projectId: project.id, status: QuoteStatus.ACCEPTED },
                });
                if (!accepted || accepted.contractorId !== user.contractorId) {
                    throw new NotFoundException('That project no longer exists.');
                }
            }
            await manager.update(Project, { id: project.id }, { status: next });
        });
        return toProjectDto(await this.loadOrFail(projectPublicId));
    }
    async loadOrFail(publicId) {
        const project = await this.dataSource.getRepository(Project).findOne({
            where: { publicId },
            relations: FULL_RELATIONS,
            order: { quotes: { createdAt: 'ASC' } },
        });
        if (!project)
            throw new NotFoundException('That project no longer exists.');
        return project;
    }
    async findQuotableOrFail(publicId) {
        const project = await this.dataSource
            .getRepository(Project)
            .findOne({ where: { publicId, status: In(QUOTABLE_STATUSES) }, relations: { category: true } });
        if (!project) {
            throw new NotFoundException('That project is not accepting quotes.');
        }
        return project;
    }
};
ProjectsService = __decorate([
    Injectable(),
    __param(0, InjectDataSource()),
    __metadata("design:paramtypes", [DataSource])
], ProjectsService);
export { ProjectsService };
//# sourceMappingURL=projects.service.js.map