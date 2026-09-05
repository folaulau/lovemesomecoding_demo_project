import type { ContractorProfile } from '../database/entities/contractor-profile.entity.js';
import type { PortfolioImage } from '../database/entities/portfolio-image.entity.js';
import type { Project } from '../database/entities/project.entity.js';
import type { Quote } from '../database/entities/quote.entity.js';
import type { Review } from '../database/entities/review.entity.js';
import type { ServiceCategory } from '../database/entities/service-category.entity.js';
import type { User } from '../database/entities/user.entity.js';
export declare function toUserDto(user: User): {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    role: import("./enums.js").UserRole;
    avatarUrl: string | null;
    createdAt: string;
};
export declare function toUserSummaryDto(user: User): {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
};
export declare function toCategoryDto(category: ServiceCategory): {
    id: string;
    slug: string;
    name: string;
    description: string;
    icon: string;
};
export declare function toPortfolioImageDto(image: PortfolioImage): {
    id: string;
    url: string;
    caption: string | null;
    sortOrder: number;
};
export declare function toContractorDto(profile: ContractorProfile): {
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
export declare function toQuoteDto(quote: Quote): {
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
    status: import("./enums.js").QuoteStatus;
    createdAt: string;
};
export declare function toReviewDto(review: Review): {
    id: string;
    projectId: string;
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
};
export declare function toProjectDto(project: Project): {
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
    status: import("./enums.js").ProjectStatus;
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
        status: import("./enums.js").QuoteStatus;
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
};
