var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { ContractorProfile } from './contractor-profile.entity.js';
let PortfolioImage = class PortfolioImage extends BaseEntity {
    contractor;
    contractorId;
    url;
    caption;
    sortOrder;
};
__decorate([
    ManyToOne(() => ContractorProfile, (profile) => profile.portfolio, {
        onDelete: 'CASCADE',
        nullable: false,
    }),
    JoinColumn({ name: 'contractor_profile_id' }),
    __metadata("design:type", ContractorProfile)
], PortfolioImage.prototype, "contractor", void 0);
__decorate([
    Column({ type: 'bigint', name: 'contractor_profile_id' }),
    __metadata("design:type", String)
], PortfolioImage.prototype, "contractorId", void 0);
__decorate([
    Column({ type: 'varchar', length: 500 }),
    __metadata("design:type", String)
], PortfolioImage.prototype, "url", void 0);
__decorate([
    Column({ type: 'varchar', length: 200, nullable: true }),
    __metadata("design:type", Object)
], PortfolioImage.prototype, "caption", void 0);
__decorate([
    Column({ type: 'int', default: 0, name: 'sort_order' }),
    __metadata("design:type", Number)
], PortfolioImage.prototype, "sortOrder", void 0);
PortfolioImage = __decorate([
    Entity('portfolio_images'),
    Index(['contractorId', 'sortOrder'])
], PortfolioImage);
export { PortfolioImage };
//# sourceMappingURL=portfolio-image.entity.js.map