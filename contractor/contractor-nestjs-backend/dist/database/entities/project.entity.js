var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, OneToOne } from 'typeorm';
import { ProjectStatus } from '../../common/enums.js';
import { BaseEntity } from './base.entity.js';
import { ServiceCategory } from './service-category.entity.js';
import { User } from './user.entity.js';
let Project = class Project extends BaseEntity {
    homeowner;
    homeownerId;
    category;
    categoryId;
    title;
    description;
    city;
    state;
    zip;
    budgetMin;
    budgetMax;
    preferredStartDate;
    status;
    quotes;
    review;
};
__decorate([
    ManyToOne(() => User, (user) => user.projects, { nullable: false }),
    JoinColumn({ name: 'homeowner_id' }),
    __metadata("design:type", User)
], Project.prototype, "homeowner", void 0);
__decorate([
    Column({ type: 'bigint', name: 'homeowner_id' }),
    __metadata("design:type", String)
], Project.prototype, "homeownerId", void 0);
__decorate([
    ManyToOne(() => ServiceCategory, (category) => category.projects, { nullable: false }),
    JoinColumn({ name: 'service_category_id' }),
    __metadata("design:type", ServiceCategory)
], Project.prototype, "category", void 0);
__decorate([
    Column({ type: 'bigint', name: 'service_category_id' }),
    __metadata("design:type", String)
], Project.prototype, "categoryId", void 0);
__decorate([
    Column({ type: 'varchar', length: 160 }),
    __metadata("design:type", String)
], Project.prototype, "title", void 0);
__decorate([
    Column({ type: 'text' }),
    __metadata("design:type", String)
], Project.prototype, "description", void 0);
__decorate([
    Column({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], Project.prototype, "city", void 0);
__decorate([
    Column({ type: 'varchar', length: 2 }),
    __metadata("design:type", String)
], Project.prototype, "state", void 0);
__decorate([
    Column({ type: 'varchar', length: 10 }),
    __metadata("design:type", String)
], Project.prototype, "zip", void 0);
__decorate([
    Column({
        type: 'numeric',
        precision: 12,
        scale: 2,
        name: 'budget_min',
        transformer: { to: (v) => v, from: (v) => (v === null ? 0 : Number(v)) },
    }),
    __metadata("design:type", Number)
], Project.prototype, "budgetMin", void 0);
__decorate([
    Column({
        type: 'numeric',
        precision: 12,
        scale: 2,
        name: 'budget_max',
        transformer: { to: (v) => v, from: (v) => (v === null ? 0 : Number(v)) },
    }),
    __metadata("design:type", Number)
], Project.prototype, "budgetMax", void 0);
__decorate([
    Column({ type: 'date', name: 'preferred_start_date' }),
    __metadata("design:type", String)
], Project.prototype, "preferredStartDate", void 0);
__decorate([
    Column({ type: 'varchar', length: 20, default: ProjectStatus.OPEN }),
    __metadata("design:type", String)
], Project.prototype, "status", void 0);
__decorate([
    OneToMany('Quote', (quote) => quote.project),
    __metadata("design:type", Array)
], Project.prototype, "quotes", void 0);
__decorate([
    OneToOne('Review', (review) => review.project),
    __metadata("design:type", Object)
], Project.prototype, "review", void 0);
Project = __decorate([
    Entity('projects'),
    Index(['status', 'categoryId', 'createdAt'])
], Project);
export { Project };
//# sourceMappingURL=project.entity.js.map