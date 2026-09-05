var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Column, CreateDateColumn, Generated, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
export class BaseEntity {
    id;
    publicId;
    createdAt;
    updatedAt;
}
__decorate([
    PrimaryGeneratedColumn('increment', { type: 'bigint' }),
    __metadata("design:type", String)
], BaseEntity.prototype, "id", void 0);
__decorate([
    Column({ type: 'uuid', unique: true, name: 'public_id' }),
    Generated('uuid'),
    __metadata("design:type", String)
], BaseEntity.prototype, "publicId", void 0);
__decorate([
    CreateDateColumn({ type: 'timestamptz', name: 'created_at' }),
    __metadata("design:type", Date)
], BaseEntity.prototype, "createdAt", void 0);
__decorate([
    UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' }),
    __metadata("design:type", Date)
], BaseEntity.prototype, "updatedAt", void 0);
//# sourceMappingURL=base.entity.js.map