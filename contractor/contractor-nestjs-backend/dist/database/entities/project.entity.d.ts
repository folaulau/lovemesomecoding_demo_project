import { ProjectStatus } from '../../common/enums.js';
import { BaseEntity } from './base.entity.js';
import type { Quote } from './quote.entity.js';
import type { Review } from './review.entity.js';
import { ServiceCategory } from './service-category.entity.js';
import { User } from './user.entity.js';
export declare class Project extends BaseEntity {
    homeowner: User;
    homeownerId: string;
    category: ServiceCategory;
    categoryId: string;
    title: string;
    description: string;
    city: string;
    state: string;
    zip: string;
    budgetMin: number;
    budgetMax: number;
    preferredStartDate: string;
    status: ProjectStatus;
    quotes: Quote[];
    review: Review | null;
}
