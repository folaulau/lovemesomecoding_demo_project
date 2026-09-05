import type { AuthenticatedUser } from '../auth/jwt-payload.js';
import { CreateQuoteDto } from './dto/quote.dto.js';
import { QuotesService } from './quotes.service.js';
export declare class QuotesController {
    private readonly quotesService;
    constructor(quotesService: QuotesService);
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
        status: import("../common/enums.js").QuoteStatus;
        createdAt: string;
    }>;
}
