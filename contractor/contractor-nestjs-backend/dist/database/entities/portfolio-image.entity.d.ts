import { BaseEntity } from './base.entity.js';
import { ContractorProfile } from './contractor-profile.entity.js';
export declare class PortfolioImage extends BaseEntity {
    contractor: ContractorProfile;
    contractorId: string;
    url: string;
    caption: string | null;
    sortOrder: number;
}
