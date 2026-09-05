var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Type } from 'class-transformer';
import { IsIn, IsISO8601, IsNumber, IsString, IsUUID, Length, Min, } from 'class-validator';
import { PROJECT_STATUSES, ProjectStatus } from '../../common/enums.js';
export class CreateProjectDto {
    categoryId;
    title;
    description;
    city;
    state;
    zip;
    budgetMin;
    budgetMax;
    preferredStartDate;
}
__decorate([
    IsUUID('4', { message: 'Pick a service category.' }),
    __metadata("design:type", String)
], CreateProjectDto.prototype, "categoryId", void 0);
__decorate([
    IsString(),
    Length(5, 160, { message: 'Give the project a title of 5 to 160 characters.' }),
    __metadata("design:type", String)
], CreateProjectDto.prototype, "title", void 0);
__decorate([
    IsString(),
    Length(20, 5000, { message: 'Describe the job in at least 20 characters.' }),
    __metadata("design:type", String)
], CreateProjectDto.prototype, "description", void 0);
__decorate([
    IsString(),
    Length(1, 100),
    __metadata("design:type", String)
], CreateProjectDto.prototype, "city", void 0);
__decorate([
    IsString(),
    Length(2, 2, { message: 'Use the two-letter state code.' }),
    __metadata("design:type", String)
], CreateProjectDto.prototype, "state", void 0);
__decorate([
    IsString(),
    Length(3, 10),
    __metadata("design:type", String)
], CreateProjectDto.prototype, "zip", void 0);
__decorate([
    Type(() => Number),
    IsNumber({}, { message: 'Enter a budget in whole dollars.' }),
    Min(0),
    __metadata("design:type", Number)
], CreateProjectDto.prototype, "budgetMin", void 0);
__decorate([
    Type(() => Number),
    IsNumber({}, { message: 'Enter a budget in whole dollars.' }),
    Min(0),
    __metadata("design:type", Number)
], CreateProjectDto.prototype, "budgetMax", void 0);
__decorate([
    IsISO8601({ strict: true }, { message: 'Pick a start date.' }),
    __metadata("design:type", String)
], CreateProjectDto.prototype, "preferredStartDate", void 0);
export class UpdateProjectStatusDto {
    status;
}
__decorate([
    IsIn(PROJECT_STATUSES),
    __metadata("design:type", String)
], UpdateProjectStatusDto.prototype, "status", void 0);
export class AcceptQuoteDto {
    quoteId;
}
__decorate([
    IsUUID('4'),
    __metadata("design:type", String)
], AcceptQuoteDto.prototype, "quoteId", void 0);
export const CANCELLABLE_BY_HOMEOWNER = [
    ProjectStatus.OPEN,
    ProjectStatus.QUOTED,
];
//# sourceMappingURL=project.dto.js.map