import { UserRole } from '../../common/enums.js';
export declare class RegisterDto {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role: typeof UserRole.HOMEOWNER | typeof UserRole.CONTRACTOR;
}
export declare class LoginDto {
    email: string;
    password: string;
}
