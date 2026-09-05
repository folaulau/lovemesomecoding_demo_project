import type { AuthenticatedUser } from '../auth/jwt-payload.js';
import { AcceptQuoteDto, CreateProjectDto, UpdateProjectStatusDto } from './dto/project.dto.js';
import { ProjectsService } from './projects.service.js';
export declare class ProjectsController {
    private readonly projectsService;
    constructor(projectsService: ProjectsService);
    create(user: AuthenticatedUser, dto: CreateProjectDto): Promise<{
        id: string;
        homeowner: {
            id: string;
            firstName: string;
            lastName: string;
            avatarUrl: string | null;
        };
        category: {
            id: string;
            slug: string;
            name: string;
            description: string;
            icon: string;
        };
        title: string;
        description: string;
        city: string;
        state: string;
        zip: string;
        budgetMin: number;
        budgetMax: number;
        preferredStartDate: string;
        status: import("../common/enums.js").ProjectStatus;
        createdAt: string;
        quotes: {
            projectId: string;
            id: string;
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
        }[];
        review: {
            projectId: string;
            id: string;
            projectTitle: string;
            homeowner: {
                id: string;
                firstName: string;
                lastName: string;
                avatarUrl: string | null;
            };
            rating: number;
            comment: string;
            createdAt: string;
        } | null;
    }>;
    acceptQuote(user: AuthenticatedUser, projectId: string, dto: AcceptQuoteDto): Promise<{
        id: string;
        homeowner: {
            id: string;
            firstName: string;
            lastName: string;
            avatarUrl: string | null;
        };
        category: {
            id: string;
            slug: string;
            name: string;
            description: string;
            icon: string;
        };
        title: string;
        description: string;
        city: string;
        state: string;
        zip: string;
        budgetMin: number;
        budgetMax: number;
        preferredStartDate: string;
        status: import("../common/enums.js").ProjectStatus;
        createdAt: string;
        quotes: {
            projectId: string;
            id: string;
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
        }[];
        review: {
            projectId: string;
            id: string;
            projectTitle: string;
            homeowner: {
                id: string;
                firstName: string;
                lastName: string;
                avatarUrl: string | null;
            };
            rating: number;
            comment: string;
            createdAt: string;
        } | null;
    }>;
    updateStatus(user: AuthenticatedUser, projectId: string, dto: UpdateProjectStatusDto): Promise<{
        id: string;
        homeowner: {
            id: string;
            firstName: string;
            lastName: string;
            avatarUrl: string | null;
        };
        category: {
            id: string;
            slug: string;
            name: string;
            description: string;
            icon: string;
        };
        title: string;
        description: string;
        city: string;
        state: string;
        zip: string;
        budgetMin: number;
        budgetMax: number;
        preferredStartDate: string;
        status: import("../common/enums.js").ProjectStatus;
        createdAt: string;
        quotes: {
            projectId: string;
            id: string;
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
        }[];
        review: {
            projectId: string;
            id: string;
            projectTitle: string;
            homeowner: {
                id: string;
                firstName: string;
                lastName: string;
                avatarUrl: string | null;
            };
            rating: number;
            comment: string;
            createdAt: string;
        } | null;
    }>;
}
