var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { QuoteStatus } from '../../common/enums.js';
import { BaseEntity } from './base.entity.js';
import { ContractorProfile } from './contractor-profile.entity.js';
import { Project } from './project.entity.js';
let Quote = class Quote extends BaseEntity {
    project;
    projectId;
    contractor;
    contractorId;
    amount;
    estimatedDays;
    message;
    status;
};
__decorate([
    ManyToOne(() => Project, (project) => project.quotes, { onDelete: 'CASCADE', nullable: false }),
    JoinColumn({ name: 'project_id' }),
    __metadata("design:type", Project)
], Quote.prototype, "project", void 0);
__decorate([
    Column({ type: 'bigint', name: 'project_id' }),
    __metadata("design:type", String)
], Quote.prototype, "projectId", void 0);
__decorate([
    ManyToOne(() => ContractorProfile, (profile) => profile.quotes, { nullable: false }),
    JoinColumn({ name: 'contractor_profile_id' }),
    __metadata("design:type", ContractorProfile)
], Quote.prototype, "contractor", void 0);
__decorate([
    Column({ type: 'bigint', name: 'contractor_profile_id' }),
    __metadata("design:type", String)
], Quote.prototype, "contractorId", void 0);
__decorate([
    Column({
        type: 'numeric',
        precision: 12,
        scale: 2,
        transformer: { to: (v) => v, from: (v) => (v === null ? 0 : Number(v)) },
    }),
    __metadata("design:type", Number)
], Quote.prototype, "amount", void 0);
__decorate([
    Column({ type: 'int', name: 'estimated_days' }),
    __metadata("design:type", Number)
], Quote.prototype, "estimatedDays", void 0);
__decorate([
    Column({ type: 'text', default: '' }),
    __metadata("design:type", String)
], Quote.prototype, "message", void 0);
__decorate([
    Column({ type: 'varchar', length: 20, default: QuoteStatus.PENDING }),
    __metadata("design:type", String)
], Quote.prototype, "status", void 0);
Quote = __decorate([
    Entity('quotes'),
    Unique('uq_quote_per_contractor_per_project', ['projectId', 'contractorId']),
    Index(['contractorId', 'createdAt'])
], Quote);
export { Quote };
//# sourceMappingURL=quote.entity.js.map