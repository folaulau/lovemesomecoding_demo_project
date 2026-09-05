var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Column, Entity, JoinColumn, JoinTable, ManyToMany, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { ServiceCategory } from './service-category.entity.js';
import { User } from './user.entity.js';
let ContractorProfile = class ContractorProfile extends BaseEntity {
    user;
    userId;
    businessName;
    bio;
    yearsInBusiness;
    licenseNumber;
    city;
    state;
    zip;
    serviceRadiusMiles;
    hourlyRateMin;
    hourlyRateMax;
    ratingAverage;
    reviewCount;
    deleted;
    categories;
    portfolio;
    quotes;
    reviews;
};
__decorate([
    OneToOne(() => User, (user) => user.contractorProfile, {
        onDelete: 'CASCADE',
        nullable: false,
    }),
    JoinColumn({ name: 'user_id' }),
    __metadata("design:type", User)
], ContractorProfile.prototype, "user", void 0);
__decorate([
    Column({ type: 'bigint', name: 'user_id' }),
    __metadata("design:type", String)
], ContractorProfile.prototype, "userId", void 0);
__decorate([
    Column({ type: 'varchar', length: 160, name: 'business_name' }),
    __metadata("design:type", String)
], ContractorProfile.prototype, "businessName", void 0);
__decorate([
    Column({ type: 'text', default: '' }),
    __metadata("design:type", String)
], ContractorProfile.prototype, "bio", void 0);
__decorate([
    Column({ type: 'int', default: 0, name: 'years_in_business' }),
    __metadata("design:type", Number)
], ContractorProfile.prototype, "yearsInBusiness", void 0);
__decorate([
    Column({ type: 'varchar', length: 60, nullable: true, name: 'license_number' }),
    __metadata("design:type", Object)
], ContractorProfile.prototype, "licenseNumber", void 0);
__decorate([
    Column({ type: 'varchar', length: 100, default: '' }),
    __metadata("design:type", String)
], ContractorProfile.prototype, "city", void 0);
__decorate([
    Column({ type: 'varchar', length: 2, default: '' }),
    __metadata("design:type", String)
], ContractorProfile.prototype, "state", void 0);
__decorate([
    Column({ type: 'varchar', length: 10, default: '' }),
    __metadata("design:type", String)
], ContractorProfile.prototype, "zip", void 0);
__decorate([
    Column({ type: 'int', default: 25, name: 'service_radius_miles' }),
    __metadata("design:type", Number)
], ContractorProfile.prototype, "serviceRadiusMiles", void 0);
__decorate([
    Column({
        type: 'numeric',
        precision: 10,
        scale: 2,
        default: 0,
        name: 'hourly_rate_min',
        transformer: {
            to: (value) => value,
            from: (value) => (value === null ? 0 : Number(value)),
        },
    }),
    __metadata("design:type", Number)
], ContractorProfile.prototype, "hourlyRateMin", void 0);
__decorate([
    Column({
        type: 'numeric',
        precision: 10,
        scale: 2,
        default: 0,
        name: 'hourly_rate_max',
        transformer: {
            to: (value) => value,
            from: (value) => (value === null ? 0 : Number(value)),
        },
    }),
    __metadata("design:type", Number)
], ContractorProfile.prototype, "hourlyRateMax", void 0);
__decorate([
    Column({
        type: 'numeric',
        precision: 3,
        scale: 2,
        default: 0,
        name: 'rating_average',
        transformer: {
            to: (value) => value,
            from: (value) => (value === null ? 0 : Number(value)),
        },
    }),
    __metadata("design:type", Number)
], ContractorProfile.prototype, "ratingAverage", void 0);
__decorate([
    Column({ type: 'int', default: 0, name: 'review_count' }),
    __metadata("design:type", Number)
], ContractorProfile.prototype, "reviewCount", void 0);
__decorate([
    Column({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], ContractorProfile.prototype, "deleted", void 0);
__decorate([
    ManyToMany(() => ServiceCategory, (category) => category.contractors),
    JoinTable({
        name: 'contractor_services',
        joinColumn: { name: 'contractor_profile_id', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'service_category_id', referencedColumnName: 'id' },
    }),
    __metadata("design:type", Array)
], ContractorProfile.prototype, "categories", void 0);
__decorate([
    OneToMany('PortfolioImage', (image) => image.contractor),
    __metadata("design:type", Array)
], ContractorProfile.prototype, "portfolio", void 0);
__decorate([
    OneToMany('Quote', (quote) => quote.contractor),
    __metadata("design:type", Array)
], ContractorProfile.prototype, "quotes", void 0);
__decorate([
    OneToMany('Review', (review) => review.contractor),
    __metadata("design:type", Array)
], ContractorProfile.prototype, "reviews", void 0);
ContractorProfile = __decorate([
    Entity('contractor_profiles')
], ContractorProfile);
export { ContractorProfile };
//# sourceMappingURL=contractor-profile.entity.js.map