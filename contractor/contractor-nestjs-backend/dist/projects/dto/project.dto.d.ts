import type { ProjectStatus as ProjectStatusType } from '../../common/enums.js';
export declare class CreateProjectDto {
    categoryId: string;
    title: string;
    description: string;
    city: string;
    state: string;
    zip: string;
    budgetMin: number;
    budgetMax: number;
    preferredStartDate: string;
}
export declare class UpdateProjectStatusDto {
    status: ProjectStatusType;
}
export declare class AcceptQuoteDto {
    quoteId: string;
}
export declare const CANCELLABLE_BY_HOMEOWNER: ProjectStatusType[];
