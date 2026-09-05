import { QuoteStatus } from '../../common/enums.js';
import { BaseEntity } from './base.entity.js';
import { ContractorProfile } from './contractor-profile.entity.js';
import { Project } from './project.entity.js';
export declare class Quote extends BaseEntity {
    project: Project;
    projectId: string;
    contractor: ContractorProfile;
    contractorId: string;
    amount: number;
    estimatedDays: number;
    message: string;
    status: QuoteStatus;
}
