import type { UserRole } from '../enums.js';
export declare const ROLES_KEY = "contractor:roles";
export declare const Roles: (...roles: UserRole[]) => import("@nestjs/common").CustomDecorator<string>;
