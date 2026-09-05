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
import { ArrayMinSize, IsArray, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, } from 'class-validator';
export class UpdateContractorProfileDto {
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
    categoryIds;
}
__decorate([
    IsString(),
    Length(2, 160, { message: 'Your business needs a name.' }),
    __metadata("design:type", String)
], UpdateContractorProfileDto.prototype, "businessName", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(5000),
    __metadata("design:type", String)
], UpdateContractorProfileDto.prototype, "bio", void 0);
__decorate([
    Type(() => Number),
    IsInt(),
    Min(0),
    Max(100),
    __metadata("design:type", Number)
], UpdateContractorProfileDto.prototype, "yearsInBusiness", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(60),
    __metadata("design:type", String)
], UpdateContractorProfileDto.prototype, "licenseNumber", void 0);
__decorate([
    IsString(),
    Length(1, 100),
    __metadata("design:type", String)
], UpdateContractorProfileDto.prototype, "city", void 0);
__decorate([
    IsString(),
    Length(2, 2, { message: 'Use the two-letter state code.' }),
    __metadata("design:type", String)
], UpdateContractorProfileDto.prototype, "state", void 0);
__decorate([
    IsString(),
    Length(3, 10),
    __metadata("design:type", String)
], UpdateContractorProfileDto.prototype, "zip", void 0);
__decorate([
    Type(() => Number),
    IsInt(),
    Min(0),
    Max(500),
    __metadata("design:type", Number)
], UpdateContractorProfileDto.prototype, "serviceRadiusMiles", void 0);
__decorate([
    Type(() => Number),
    IsNumber({ maxDecimalPlaces: 2 }),
    Min(0),
    __metadata("design:type", Number)
], UpdateContractorProfileDto.prototype, "hourlyRateMin", void 0);
__decorate([
    Type(() => Number),
    IsNumber({ maxDecimalPlaces: 2 }),
    Min(0),
    __metadata("design:type", Number)
], UpdateContractorProfileDto.prototype, "hourlyRateMax", void 0);
__decorate([
    IsArray(),
    ArrayMinSize(1, { message: 'Pick at least one service so homeowners can find you.' }),
    IsUUID('4', { each: true }),
    __metadata("design:type", Array)
], UpdateContractorProfileDto.prototype, "categoryIds", void 0);
export class AddPortfolioImageDto {
    caption;
}
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(200),
    __metadata("design:type", String)
], AddPortfolioImageDto.prototype, "caption", void 0);
//# sourceMappingURL=contractor.dto.js.map