import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import type { AuthenticatedUser } from '../auth/jwt-payload.js';
import type { AppConfig } from '../config/configuration.js';
import type { UpdateContractorProfileDto } from './dto/contractor.dto.js';
export declare class ContractorsService {
    private readonly dataSource;
    private readonly config;
    constructor(dataSource: DataSource, config: ConfigService<AppConfig>);
    updateProfile(user: AuthenticatedUser, dto: UpdateContractorProfileDto): Promise<{
        id: string;
        user: {
            id: string;
            firstName: string;
            lastName: string;
            avatarUrl: string | null;
        };
        businessName: string;
        bio: string;
        yearsInBusiness: number;
        licenseNumber: string | null;
        city: string;
        state: string;
        zip: string;
        serviceRadiusMiles: number;
        hourlyRateMin: number;
        hourlyRateMax: number;
        ratingAverage: number;
        reviewCount: number;
        categories: {
            id: string;
            slug: string;
            name: string;
            description: string;
            icon: string;
        }[];
        portfolio: {
            id: string;
            url: string;
            caption: string | null;
            sortOrder: number;
        }[];
    }>;
    addPortfolioImage(user: AuthenticatedUser, file: {
        buffer: Buffer;
        size: number;
        mimetype: string;
        originalname: string;
    } | undefined, caption: string | undefined): Promise<{
        id: string;
        url: string;
        caption: string | null;
        sortOrder: number;
    }>;
    removePortfolioImage(user: AuthenticatedUser, imagePublicId: string): Promise<void>;
    private loadOwnProfile;
}
