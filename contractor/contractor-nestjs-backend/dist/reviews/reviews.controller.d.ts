import type { AuthenticatedUser } from '../auth/jwt-payload.js';
import { CreateReviewDto } from './dto/review.dto.js';
import { ReviewsService } from './reviews.service.js';
export declare class ReviewsController {
    private readonly reviewsService;
    constructor(reviewsService: ReviewsService);
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
}
