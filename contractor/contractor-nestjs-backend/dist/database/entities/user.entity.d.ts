import type { UserRole } from '../../common/enums.js';
import { BaseEntity } from './base.entity.js';
import type { ContractorProfile } from './contractor-profile.entity.js';
import type { Project } from './project.entity.js';
export declare class User extends BaseEntity {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    role: UserRole;
    avatarUrl: string | null;
    deleted: boolean;
    contractorProfile: ContractorProfile | null;
    projects: Project[];
    get fullName(): string;
}
export declare const USER_ROLE_VALUES: ("contractor" | "homeowner" | "staff")[];
