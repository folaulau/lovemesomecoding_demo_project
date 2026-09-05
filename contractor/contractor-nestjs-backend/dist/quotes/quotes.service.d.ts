import { DataSource } from 'typeorm';
import type { AuthenticatedUser } from '../auth/jwt-payload.js';
import { QuoteStatus } from '../common/enums.js';
import { ProjectsService } from '../projects/projects.service.js';
import type { CreateQuoteDto } from './dto/quote.dto.js';
export declare class QuotesService {
    private readonly dataSource;
    private readonly projectsService;
    constructor(dataSource: DataSource, projectsService: ProjectsService);
    create(user: AuthenticatedUser, dto: CreateQuoteDto): Promise<{
        id: string;
        projectId: string;
        contractor: {
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
        };
        amount: number;
        estimatedDays: number;
        message: string;
        status: QuoteStatus;
        createdAt: string;
    }>;
}
