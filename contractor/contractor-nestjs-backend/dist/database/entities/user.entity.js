var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Column, Entity, Index, OneToMany, OneToOne } from 'typeorm';
import { USER_ROLES } from '../../common/enums.js';
import { BaseEntity } from './base.entity.js';
let User = class User extends BaseEntity {
    email;
    passwordHash;
    firstName;
    lastName;
    phone;
    role;
    avatarUrl;
    deleted;
    contractorProfile;
    projects;
    get fullName() {
        return `${this.firstName} ${this.lastName}`;
    }
};
__decorate([
    Index({ unique: true }),
    Column({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], User.prototype, "email", void 0);
__decorate([
    Column({ type: 'varchar', length: 72, name: 'password_hash' }),
    __metadata("design:type", String)
], User.prototype, "passwordHash", void 0);
__decorate([
    Column({ type: 'varchar', length: 80, name: 'first_name' }),
    __metadata("design:type", String)
], User.prototype, "firstName", void 0);
__decorate([
    Column({ type: 'varchar', length: 80, name: 'last_name' }),
    __metadata("design:type", String)
], User.prototype, "lastName", void 0);
__decorate([
    Column({ type: 'varchar', length: 40, nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "phone", void 0);
__decorate([
    Column({ type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], User.prototype, "role", void 0);
__decorate([
    Column({ type: 'varchar', length: 500, nullable: true, name: 'avatar_url' }),
    __metadata("design:type", Object)
], User.prototype, "avatarUrl", void 0);
__decorate([
    Column({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], User.prototype, "deleted", void 0);
__decorate([
    OneToOne('ContractorProfile', (profile) => profile.user),
    __metadata("design:type", Object)
], User.prototype, "contractorProfile", void 0);
__decorate([
    OneToMany('Project', (project) => project.homeowner),
    __metadata("design:type", Array)
], User.prototype, "projects", void 0);
User = __decorate([
    Entity('users')
], User);
export { User };
export const USER_ROLE_VALUES = USER_ROLES;
//# sourceMappingURL=user.entity.js.map