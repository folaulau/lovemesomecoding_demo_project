import type { AuthenticatedUser } from './jwt-payload.js';
import { AuthService } from './auth.service.js';
import { LoginDto, RegisterDto } from './dto/auth.dto.js';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(dto: RegisterDto): Promise<{
        token: string;
        user: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            phone: string | null;
            role: import("../common/enums.js").UserRole;
            avatarUrl: string | null;
            createdAt: string;
        };
    }>;
    login(dto: LoginDto): Promise<{
        token: string;
        user: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            phone: string | null;
            role: import("../common/enums.js").UserRole;
            avatarUrl: string | null;
            createdAt: string;
        };
    }>;
    me(user: AuthenticatedUser): AuthenticatedUser;
}
