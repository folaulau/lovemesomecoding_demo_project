var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Check, Column, Entity, Index, JoinColumn, ManyToOne, OneToOne } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { ContractorProfile } from './contractor-profile.entity.js';
import { Project } from './project.entity.js';
import { User } from './user.entity.js';
let Review = class Review extends BaseEntity {
    project;
    projectId;
    homeowner;
    homeownerId;
    contractor;
    contractorId;
    projectTitle;
    rating;
    comment;
};
__decorate([
    OneToOne(() => Project, (project) => project.review, { onDelete: 'CASCADE', nullable: false }),
    JoinColumn({ name: 'project_id' }),
    __metadata("design:type", Project)
], Review.prototype, "project", void 0);
__decorate([
    Column({ type: 'bigint', name: 'project_id', unique: true }),
    __metadata("design:type", String)
], Review.prototype, "projectId", void 0);
__decorate([
    ManyToOne(() => User, { nullable: false }),
    JoinColumn({ name: 'homeowner_id' }),
    __metadata("design:type", User)
], Review.prototype, "homeowner", void 0);
__decorate([
    Column({ type: 'bigint', name: 'homeowner_id' }),
    __metadata("design:type", String)
], Review.prototype, "homeownerId", void 0);
__decorate([
    ManyToOne(() => ContractorProfile, (profile) => profile.reviews, { nullable: false }),
    JoinColumn({ name: 'contractor_profile_id' }),
    __metadata("design:type", ContractorProfile)
], Review.prototype, "contractor", void 0);
__decorate([
    Column({ type: 'bigint', name: 'contractor_profile_id' }),
    __metadata("design:type", String)
], Review.prototype, "contractorId", void 0);
__decorate([
    Column({ type: 'varchar', length: 160, name: 'project_title' }),
    __metadata("design:type", String)
], Review.prototype, "projectTitle", void 0);
__decorate([
    Column({ type: 'int' }),
    __metadata("design:type", Number)
], Review.prototype, "rating", void 0);
__decorate([
    Column({ type: 'text', default: '' }),
    __metadata("design:type", String)
], Review.prototype, "comment", void 0);
Review = __decorate([
    Entity('reviews'),
    Check('ck_review_rating_range', '"rating" >= 1 AND "rating" <= 5'),
    Index(['contractorId', 'createdAt'])
], Review);
export { Review };
//# sourceMappingURL=review.entity.js.map