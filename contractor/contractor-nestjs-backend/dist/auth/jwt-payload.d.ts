import type { UserRole } from '../common/enums.js';
export declare const HASURA_CLAIMS_NAMESPACE = "https://hasura.io/jwt/claims";
export interface HasuraClaims {
    'x-hasura-allowed-roles': UserRole[];
    'x-hasura-default-role': UserRole;
    'x-hasura-user-id': string;
    'x-hasura-contractor-id'?: string;
}
export interface JwtPayload {
    sub: string;
    email: string;
    role: UserRole;
    [HASURA_CLAIMS_NAMESPACE]: HasuraClaims;
}
export interface AuthenticatedUser {
    id: string;
    publicId: string;
    email: string;
    role: UserRole;
    contractorId?: string;
}
