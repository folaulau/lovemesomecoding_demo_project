import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { UserRole } from '../common/enums.js';
import type { LoginDto, RegisterDto } from './dto/auth.dto.js';
export declare class AuthService {
    private readonly dataSource;
    private readonly jwtService;
    constructor(dataSource: DataSource, jwtService: JwtService);
    register(dto: RegisterDto): Promise<{
        token: string;
        user: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            phone: string | null;
            role: UserRole;
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
            role: UserRole;
            avatarUrl: string | null;
            createdAt: string;
        };
    }>;
    private signToken;
}
