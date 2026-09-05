var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
let RequestIdMiddleware = class RequestIdMiddleware {
    use(req, res, next) {
        const id = incomingId(req) ?? randomUUID();
        req.requestId = id;
        res.setHeader('x-request-id', id);
        next();
    }
};
RequestIdMiddleware = __decorate([
    Injectable()
], RequestIdMiddleware);
export { RequestIdMiddleware };
function incomingId(req) {
    const header = req.headers['x-request-id'];
    if (typeof header !== 'string')
        return null;
    const trimmed = header.trim();
    if (trimmed.length === 0 || trimmed.length > 64)
        return null;
    return /^[A-Za-z0-9._-]+$/.test(trimmed) ? trimmed : null;
}
export function requestIdOf(req) {
    return req.requestId ?? '-';
}
//# sourceMappingURL=request-id.middleware.js.map