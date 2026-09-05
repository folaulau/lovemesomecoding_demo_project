import { BaseEntity } from './base.entity.js';
import type { PortfolioImage } from './portfolio-image.entity.js';
import type { Quote } from './quote.entity.js';
import type { Review } from './review.entity.js';
import { ServiceCategory } from './service-category.entity.js';
import { User } from './user.entity.js';
export declare class ContractorProfile extends BaseEntity {
    user: User;
    userId: string;
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
    deleted: boolean;
    categories: ServiceCategory[];
    portfolio: PortfolioImage[];
    quotes: Quote[];
    reviews: Review[];
}
