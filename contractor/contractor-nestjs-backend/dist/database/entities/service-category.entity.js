var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Column, Entity, Index, ManyToMany, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity.js';
let ServiceCategory = class ServiceCategory extends BaseEntity {
    slug;
    name;
    description;
    icon;
    contractors;
    projects;
};
__decorate([
    Index({ unique: true }),
    Column({ type: 'varchar', length: 60 }),
    __metadata("design:type", String)
], ServiceCategory.prototype, "slug", void 0);
__decorate([
    Column({ type: 'varchar', length: 80 }),
    __metadata("design:type", String)
], ServiceCategory.prototype, "name", void 0);
__decorate([
    Column({ type: 'varchar', length: 300 }),
    __metadata("design:type", String)
], ServiceCategory.prototype, "description", void 0);
__decorate([
    Column({ type: 'varchar', length: 8 }),
    __metadata("design:type", String)
], ServiceCategory.prototype, "icon", void 0);
__decorate([
    ManyToMany('ContractorProfile', (profile) => profile.categories),
    __metadata("design:type", Array)
], ServiceCategory.prototype, "contractors", void 0);
__decorate([
    OneToMany('Project', (project) => project.category),
    __metadata("design:type", Array)
], ServiceCategory.prototype, "projects", void 0);
ServiceCategory = __decorate([
    Entity('service_categories')
], ServiceCategory);
export { ServiceCategory };
//# sourceMappingURL=service-category.entity.js.map