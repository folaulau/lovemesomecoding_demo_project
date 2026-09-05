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
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ProjectStatus, QuoteStatus } from '../common/enums.js';
import { toReviewDto } from '../common/serializers.js';
import { ContractorProfile } from '../database/entities/contractor-profile.entity.js';
import { Project } from '../database/entities/project.entity.js';
import { Quote } from '../database/entities/quote.entity.js';
import { Review } from '../database/entities/review.entity.js';
let ReviewsService = class ReviewsService {
    dataSource;
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    async create(user, dto) {
        const reviewId = await this.dataSource.transaction(async (manager) => {
            const project = await manager.findOne(Project, { where: { publicId: dto.projectId } });
            if (!project || project.homeownerId !== user.id) {
                throw new NotFoundException('That project no longer exists.');
            }
            if (project.status !== ProjectStatus.COMPLETED) {
                throw new ConflictException('You can leave a review once the work is marked complete.');
            }
            const existing = await manager.findOne(Review, { where: { projectId: project.id } });
            if (existing)
                throw new ConflictException('You have already reviewed this project.');
            const accepted = await manager.findOne(Quote, {
                where: { projectId: project.id, status: QuoteStatus.ACCEPTED },
            });
            if (!accepted) {
                throw new ConflictException('This project never had a contractor hired on it.');
            }
            const review = manager.create(Review, {
                projectId: project.id,
                projectTitle: project.title,
                homeownerId: user.id,
                contractorId: accepted.contractorId,
                rating: dto.rating,
                comment: dto.comment?.trim() ?? '',
            });
            await manager.save(review);
            await this.recomputeRating(manager, accepted.contractorId);
            return review.id;
        });
        const saved = await this.dataSource.getRepository(Review).findOneOrFail({
            where: { id: reviewId },
            relations: { project: true, homeowner: true },
        });
        return toReviewDto(saved);
    }
    async recomputeRating(manager, contractorId) {
        const result = await manager
            .createQueryBuilder(Review, 'review')
            .select('COUNT(*)', 'count')
            .addSelect('COALESCE(ROUND(AVG(review.rating), 2), 0)', 'average')
            .where('review.contractor_profile_id = :contractorId', { contractorId })
            .getRawOne();
        await manager.update(ContractorProfile, { id: contractorId }, {
            reviewCount: Number(result?.count ?? 0),
            ratingAverage: Number(result?.average ?? 0),
        });
    }
};
ReviewsService = __decorate([
    Injectable(),
    __param(0, InjectDataSource()),
    __metadata("design:paramtypes", [DataSource])
], ReviewsService);
export { ReviewsService };
//# sourceMappingURL=reviews.service.js.map