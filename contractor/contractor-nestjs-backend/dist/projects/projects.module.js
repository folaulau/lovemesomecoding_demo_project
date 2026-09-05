var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../database/entities/project.entity.js';
import { Quote } from '../database/entities/quote.entity.js';
import { ServiceCategory } from '../database/entities/service-category.entity.js';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';
let ProjectsModule = class ProjectsModule {
};
ProjectsModule = __decorate([
    Module({
        imports: [TypeOrmModule.forFeature([Project, Quote, ServiceCategory])],
        controllers: [ProjectsController],
        providers: [ProjectsService],
        exports: [ProjectsService],
    })
], ProjectsModule);
export { ProjectsModule };
//# sourceMappingURL=projects.module.js.map