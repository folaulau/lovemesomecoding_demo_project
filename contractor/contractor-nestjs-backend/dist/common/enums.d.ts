export declare const UserRole: {
    readonly HOMEOWNER: "homeowner";
    readonly CONTRACTOR: "contractor";
    readonly STAFF: "staff";
};
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
export declare const ProjectStatus: {
    readonly OPEN: "open";
    readonly QUOTED: "quoted";
    readonly HIRED: "hired";
    readonly IN_PROGRESS: "in_progress";
    readonly COMPLETED: "completed";
    readonly CANCELLED: "cancelled";
};
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];
export declare const QuoteStatus: {
    readonly PENDING: "pending";
    readonly ACCEPTED: "accepted";
    readonly DECLINED: "declined";
    readonly WITHDRAWN: "withdrawn";
};
export type QuoteStatus = (typeof QuoteStatus)[keyof typeof QuoteStatus];
export declare const USER_ROLES: ("contractor" | "homeowner" | "staff")[];
export declare const PROJECT_STATUSES: ("open" | "quoted" | "hired" | "in_progress" | "completed" | "cancelled")[];
export declare const QUOTE_STATUSES: ("pending" | "accepted" | "declined" | "withdrawn")[];
export declare const QUOTABLE_STATUSES: ProjectStatus[];
