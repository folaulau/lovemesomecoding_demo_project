var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Body, Controller, Delete, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UploadedFile, UseGuards, UseInterceptors, } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../common/enums.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { ContractorsService } from './contractors.service.js';
import { AddPortfolioImageDto, UpdateContractorProfileDto } from './dto/contractor.dto.js';
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
let ContractorsController = class ContractorsController {
    contractorsService;
    constructor(contractorsService) {
        this.contractorsService = contractorsService;
    }
    updateProfile(user, dto) {
        return this.contractorsService.updateProfile(user, dto);
    }
    addPortfolioImage(user, file, dto) {
        return this.contractorsService.addPortfolioImage(user, file, dto.caption);
    }
    async removePortfolioImage(user, imageId) {
        await this.contractorsService.removePortfolioImage(user, imageId);
    }
};
__decorate([
    Patch('me'),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, UpdateContractorProfileDto]),
    __metadata("design:returntype", void 0)
], ContractorsController.prototype, "updateProfile", null);
__decorate([
    Post('me/portfolio'),
    UseInterceptors(FileInterceptor('file', {
        storage: memoryStorage(),
        limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
    })),
    __param(0, CurrentUser()),
    __param(1, UploadedFile()),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, AddPortfolioImageDto]),
    __metadata("design:returntype", void 0)
], ContractorsController.prototype, "addPortfolioImage", null);
__decorate([
    Delete('me/portfolio/:imageId'),
    HttpCode(HttpStatus.NO_CONTENT),
    __param(0, CurrentUser()),
    __param(1, Param('imageId', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ContractorsController.prototype, "removePortfolioImage", null);
ContractorsController = __decorate([
    Controller('api/v1/contractors'),
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(UserRole.CONTRACTOR),
    __metadata("design:paramtypes", [ContractorsService])
], ContractorsController);
export { ContractorsController };
//# sourceMappingURL=contractors.controller.js.map