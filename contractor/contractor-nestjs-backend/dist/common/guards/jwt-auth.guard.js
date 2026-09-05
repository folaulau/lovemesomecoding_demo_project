var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { HASURA_CLAIMS_NAMESPACE } from '../../auth/jwt-payload.js';
let JwtAuthGuard = class JwtAuthGuard {
    jwtService;
    constructor(jwtService) {
        this.jwtService = jwtService;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const token = extractBearerToken(request);
        if (!token) {
            throw new UnauthorizedException('Sign in to do that.');
        }
        try {
            const payload = await this.jwtService.verifyAsync(token);
            const claims = payload[HASURA_CLAIMS_NAMESPACE];
            request.user = {
                id: claims['x-hasura-user-id'],
                publicId: payload.sub,
                email: payload.email,
                role: payload.role,
                contractorId: claims['x-hasura-contractor-id'],
            };
            return true;
        }
        catch {
            throw new UnauthorizedException('Your session has expired. Sign in again.');
        }
    }
};
JwtAuthGuard = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [JwtService])
], JwtAuthGuard);
export { JwtAuthGuard };
function extractBearerToken(request) {
    const header = request.headers.authorization;
    if (!header)
        return null;
    const [scheme, token] = header.split(' ');
    if (!scheme || !token || scheme.toLowerCase() !== 'bearer')
        return null;
    return token.trim();
}
//# sourceMappingURL=jwt-auth.guard.js.map