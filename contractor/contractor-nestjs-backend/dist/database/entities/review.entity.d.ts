import { BaseEntity } from './base.entity.js';
import { ContractorProfile } from './contractor-profile.entity.js';
import { Project } from './project.entity.js';
import { User } from './user.entity.js';
export declare class Review extends BaseEntity {
    project: Project;
    projectId: string;
    homeowner: User;
    homeownerId: string;
    contractor: ContractorProfile;
    contractorId: string;
    projectTitle: string;
    rating: number;
    comment: string;
}
