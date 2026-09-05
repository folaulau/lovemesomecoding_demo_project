export const UserRole = {
    HOMEOWNER: 'homeowner',
    CONTRACTOR: 'contractor',
    STAFF: 'staff',
};
export const ProjectStatus = {
    OPEN: 'open',
    QUOTED: 'quoted',
    HIRED: 'hired',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
};
export const QuoteStatus = {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    DECLINED: 'declined',
    WITHDRAWN: 'withdrawn',
};
export const USER_ROLES = Object.values(UserRole);
export const PROJECT_STATUSES = Object.values(ProjectStatus);
export const QUOTE_STATUSES = Object.values(QuoteStatus);
export const QUOTABLE_STATUSES = [ProjectStatus.OPEN, ProjectStatus.QUOTED];
//# sourceMappingURL=enums.js.map