import { DataSource } from 'typeorm';
import { ProjectStatus, QuoteStatus } from '../common/enums.js';
import type { ProjectStatus as ProjectStatusType } from '../common/enums.js';
import { Project } from '../database/entities/project.entity.js';
import type { AuthenticatedUser } from '../auth/jwt-payload.js';
import type { CreateProjectDto } from './dto/project.dto.js';
export declare class ProjectsService {
    private readonly dataSource;
    constructor(dataSource: DataSource);
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
        status: ProjectStatus;
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
            status: QuoteStatus;
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
    acceptQuote(user: AuthenticatedUser, projectPublicId: string, quotePublicId: string): Promise<{
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
        status: ProjectStatus;
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
            status: QuoteStatus;
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
    updateStatus(user: AuthenticatedUser, projectPublicId: string, next: ProjectStatusType): Promise<{
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
        status: ProjectStatus;
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
            status: QuoteStatus;
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
    private loadOrFail;
    findQuotableOrFail(publicId: string): Promise<Project>;
}
