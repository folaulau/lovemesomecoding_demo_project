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
import { Body, Controller, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../common/enums.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { AcceptQuoteDto, CreateProjectDto, UpdateProjectStatusDto } from './dto/project.dto.js';
import { ProjectsService } from './projects.service.js';
let ProjectsController = class ProjectsController {
    projectsService;
    constructor(projectsService) {
        this.projectsService = projectsService;
    }
    create(user, dto) {
        return this.projectsService.create(user, dto);
    }
    acceptQuote(user, projectId, dto) {
        return this.projectsService.acceptQuote(user, projectId, dto.quoteId);
    }
    updateStatus(user, projectId, dto) {
        return this.projectsService.updateStatus(user, projectId, dto.status);
    }
};
__decorate([
    Post(),
    Roles(UserRole.HOMEOWNER),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreateProjectDto]),
    __metadata("design:returntype", void 0)
], ProjectsController.prototype, "create", null);
__decorate([
    Post(':projectId/accept-quote'),
    Roles(UserRole.HOMEOWNER),
    __param(0, CurrentUser()),
    __param(1, Param('projectId', ParseUUIDPipe)),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, AcceptQuoteDto]),
    __metadata("design:returntype", void 0)
], ProjectsController.prototype, "acceptQuote", null);
__decorate([
    Patch(':projectId/status'),
    __param(0, CurrentUser()),
    __param(1, Param('projectId', ParseUUIDPipe)),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, UpdateProjectStatusDto]),
    __metadata("design:returntype", void 0)
], ProjectsController.prototype, "updateStatus", null);
ProjectsController = __decorate([
    Controller('api/v1/projects'),
    UseGuards(JwtAuthGuard, RolesGuard),
    __metadata("design:paramtypes", [ProjectsService])
], ProjectsController);
export { ProjectsController };
//# sourceMappingURL=projects.controller.js.map