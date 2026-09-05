import { DataSource } from 'typeorm';
import type { AuthenticatedUser } from '../auth/jwt-payload.js';
import type { CreateReviewDto } from './dto/review.dto.js';
export declare class ReviewsService {
    private readonly dataSource;
    constructor(dataSource: DataSource);
    create(user: AuthenticatedUser, dto: CreateReviewDto): Promise<{
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
    }>;
    private recomputeRating;
}
