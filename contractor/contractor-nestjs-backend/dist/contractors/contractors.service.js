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
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { BadRequestException, Injectable, NotFoundException, PayloadTooLargeException, UnsupportedMediaTypeException, } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { toContractorDto, toPortfolioImageDto } from '../common/serializers.js';
import { ContractorProfile } from '../database/entities/contractor-profile.entity.js';
import { PortfolioImage } from '../database/entities/portfolio-image.entity.js';
import { ServiceCategory } from '../database/entities/service-category.entity.js';
import { sniffImageType } from './image-validation.js';
const PROFILE_RELATIONS = { user: true, categories: true, portfolio: true };
let ContractorsService = class ContractorsService {
    dataSource;
    config;
    constructor(dataSource, config) {
        this.dataSource = dataSource;
        this.config = config;
    }
    async updateProfile(user, dto) {
        if (dto.hourlyRateMax < dto.hourlyRateMin) {
            throw new BadRequestException('The top of your rate cannot be below the bottom of it.');
        }
        const profile = await this.loadOwnProfile(user);
        const categories = await this.dataSource
            .getRepository(ServiceCategory)
            .find({ where: { publicId: In(dto.categoryIds) } });
        if (categories.length !== dto.categoryIds.length) {
            throw new BadRequestException('One of those services does not exist.');
        }
        Object.assign(profile, {
            businessName: dto.businessName.trim(),
            bio: dto.bio?.trim() ?? '',
            yearsInBusiness: dto.yearsInBusiness,
            licenseNumber: dto.licenseNumber?.trim() || null,
            city: dto.city.trim(),
            state: dto.state.trim().toUpperCase(),
            zip: dto.zip.trim(),
            serviceRadiusMiles: dto.serviceRadiusMiles,
            hourlyRateMin: dto.hourlyRateMin,
            hourlyRateMax: dto.hourlyRateMax,
            categories,
        });
        const saved = await this.dataSource.getRepository(ContractorProfile).save(profile);
        return toContractorDto(await this.dataSource.getRepository(ContractorProfile).findOneOrFail({
            where: { id: saved.id },
            relations: PROFILE_RELATIONS,
        }));
    }
    async addPortfolioImage(user, file, caption) {
        if (!file)
            throw new BadRequestException('Choose an image to upload.');
        const uploads = this.config.getOrThrow('uploads');
        if (file.buffer.length > uploads.maxBytes) {
            const mb = Math.round(uploads.maxBytes / (1024 * 1024));
            throw new PayloadTooLargeException(`Images must be ${mb} MB or smaller.`);
        }
        const sniffed = sniffImageType(file.buffer);
        if (!sniffed) {
            throw new UnsupportedMediaTypeException('Upload a JPEG, PNG or WebP image.');
        }
        const profile = await this.loadOwnProfile(user);
        const filename = `${randomUUID()}.${sniffed.extension}`;
        const directory = resolve(process.cwd(), uploads.directory);
        await mkdir(directory, { recursive: true });
        await writeFile(join(directory, filename), file.buffer);
        const url = `/uploads/${filename}`;
        const image = this.dataSource.getRepository(PortfolioImage).create({
            contractorId: profile.id,
            url,
            caption: caption?.trim() || null,
            sortOrder: profile.portfolio.length,
        });
        const saved = await this.dataSource.getRepository(PortfolioImage).save(image);
        return toPortfolioImageDto(saved);
    }
    async removePortfolioImage(user, imagePublicId) {
        const profile = await this.loadOwnProfile(user);
        const image = await this.dataSource.getRepository(PortfolioImage).findOne({
            where: { publicId: imagePublicId, contractorId: profile.id },
        });
        if (!image)
            throw new NotFoundException('That image no longer exists.');
        await this.dataSource.getRepository(PortfolioImage).remove(image);
        const uploads = this.config.getOrThrow('uploads');
        const filename = image.url.split('/').pop();
        if (filename) {
            await unlink(join(resolve(process.cwd(), uploads.directory), filename)).catch(() => {
            });
        }
    }
    async loadOwnProfile(user) {
        if (!user.contractorId) {
            throw new NotFoundException('This account has no contractor profile.');
        }
        const profile = await this.dataSource.getRepository(ContractorProfile).findOne({
            where: { id: user.contractorId },
            relations: PROFILE_RELATIONS,
        });
        if (!profile)
            throw new NotFoundException('This account has no contractor profile.');
        return profile;
    }
};
ContractorsService = __decorate([
    Injectable(),
    __param(0, InjectDataSource()),
    __metadata("design:paramtypes", [DataSource,
        ConfigService])
], ContractorsService);
export { ContractorsService };
//# sourceMappingURL=contractors.service.js.map