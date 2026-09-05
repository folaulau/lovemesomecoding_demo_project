import type { AuthenticatedUser } from '../auth/jwt-payload.js';
import { ContractorsService } from './contractors.service.js';
import { AddPortfolioImageDto, UpdateContractorProfileDto } from './dto/contractor.dto.js';
export declare class ContractorsController {
    private readonly contractorsService;
    constructor(contractorsService: ContractorsService);
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
    addPortfolioImage(user: AuthenticatedUser, file: Express.Multer.File | undefined, dto: AddPortfolioImageDto): Promise<{
        id: string;
        url: string;
        caption: string | null;
        sortOrder: number;
    }>;
    removePortfolioImage(user: AuthenticatedUser, imageId: string): Promise<void>;
}
