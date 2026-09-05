import type { NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
export declare class RequestIdMiddleware implements NestMiddleware {
    use(req: RequestWithId, res: Response, next: NextFunction): void;
}
export type RequestWithId = Request & {
    requestId?: string;
};
export declare function requestIdOf(req: RequestWithId): string;
