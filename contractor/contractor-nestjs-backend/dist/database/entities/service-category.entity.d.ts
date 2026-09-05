import { BaseEntity } from './base.entity.js';
import type { ContractorProfile } from './contractor-profile.entity.js';
import type { Project } from './project.entity.js';
export declare class ServiceCategory extends BaseEntity {
    slug: string;
    name: string;
    description: string;
    icon: string;
    contractors: ContractorProfile[];
    projects: Project[];
}
