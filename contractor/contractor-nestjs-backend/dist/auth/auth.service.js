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
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { UserRole } from '../common/enums.js';
import { toUserDto } from '../common/serializers.js';
import { ContractorProfile } from '../database/entities/contractor-profile.entity.js';
import { User } from '../database/entities/user.entity.js';
import { HASURA_CLAIMS_NAMESPACE } from './jwt-payload.js';
const BCRYPT_ROUNDS = 12;
let AuthService = class AuthService {
    dataSource;
    jwtService;
    constructor(dataSource, jwtService) {
        this.dataSource = dataSource;
        this.jwtService = jwtService;
    }
    async register(dto) {
        const email = dto.email.trim().toLowerCase();
        return this.dataSource.transaction(async (manager) => {
            const existing = await manager.findOne(User, { where: { email } });
            if (existing) {
                throw new ConflictException('An account with that email already exists.');
            }
            const user = manager.create(User, {
                email,
                passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
                firstName: dto.firstName.trim(),
                lastName: dto.lastName.trim(),
                phone: dto.phone?.trim() || null,
                role: dto.role,
                avatarUrl: null,
                deleted: false,
            });
            await manager.save(user);
            let profile = null;
            if (user.role === UserRole.CONTRACTOR) {
                profile = manager.create(ContractorProfile, {
                    user,
                    businessName: `${user.firstName} ${user.lastName}`,
                    bio: '',
                    yearsInBusiness: 0,
                    licenseNumber: null,
                    city: '',
                    state: '',
                    zip: '',
                    serviceRadiusMiles: 25,
                    hourlyRateMin: 0,
                    hourlyRateMax: 0,
                    ratingAverage: 0,
                    reviewCount: 0,
                    deleted: false,
                    categories: [],
                });
                await manager.save(profile);
            }
            return {
                token: await this.signToken(user, profile?.id),
                user: toUserDto(user),
            };
        });
    }
    async login(dto) {
        const email = dto.email.trim().toLowerCase();
        const user = await this.dataSource.getRepository(User).findOne({ where: { email } });
        const invalid = new UnauthorizedException('That email and password do not match an account.');
        if (!user || user.deleted) {
            await bcrypt.compare(dto.password, DUMMY_HASH);
            throw invalid;
        }
        const matches = await bcrypt.compare(dto.password, user.passwordHash);
        if (!matches)
            throw invalid;
        const profile = user.role === UserRole.CONTRACTOR
            ? await this.dataSource
                .getRepository(ContractorProfile)
                .findOne({ where: { userId: user.id } })
            : null;
        return {
            token: await this.signToken(user, profile?.id),
            user: toUserDto(user),
        };
    }
    async signToken(user, contractorProfileId) {
        const payload = {
            sub: user.publicId,
            email: user.email,
            role: user.role,
            [HASURA_CLAIMS_NAMESPACE]: {
                'x-hasura-allowed-roles': [user.role],
                'x-hasura-default-role': user.role,
                'x-hasura-user-id': String(user.id),
                ...(contractorProfileId ? { 'x-hasura-contractor-id': String(contractorProfileId) } : {}),
            },
        };
        return this.jwtService.signAsync(payload);
    }
};
AuthService = __decorate([
    Injectable(),
    __param(0, InjectDataSource()),
    __metadata("design:paramtypes", [DataSource,
        JwtService])
], AuthService);
export { AuthService };
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.rNAWK/vNWaVnpUjnaZ5CmNBZ2H8Uu8W';
//# sourceMappingURL=auth.service.js.map