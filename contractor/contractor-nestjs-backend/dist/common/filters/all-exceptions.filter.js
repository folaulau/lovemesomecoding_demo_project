var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { requestIdOf } from '../middleware/request-id.middleware.js';
const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';
let AllExceptionsFilter = class AllExceptionsFilter {
    logger = new Logger('Exceptions');
    catch(exception, host) {
        if (host.getType() !== 'http')
            throw exception;
        const http = host.switchToHttp();
        const response = http.getResponse();
        const request = http.getRequest();
        const { status, body } = describe(exception);
        if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
            this.logger.error(`${request.method} ${request.originalUrl} -> ${status} req=${requestIdOf(request)}`, exception instanceof Error ? exception.stack : String(exception));
        }
        response.status(status).json({
            ...body,
            statusCode: status,
            path: request.originalUrl,
            timestamp: new Date().toISOString(),
            requestId: requestIdOf(request),
        });
    }
};
AllExceptionsFilter = __decorate([
    Catch()
], AllExceptionsFilter);
export { AllExceptionsFilter };
function describe(exception) {
    if (exception instanceof HttpException) {
        const payload = exception.getResponse();
        return {
            status: exception.getStatus(),
            body: typeof payload === 'string' ? { message: payload } : { ...payload },
        };
    }
    if (exception instanceof QueryFailedError) {
        const code = exception.driverError?.code;
        if (code === PG_UNIQUE_VIOLATION) {
            return {
                status: HttpStatus.CONFLICT,
                body: { message: 'That has already been done.', error: 'Conflict' },
            };
        }
        if (code === PG_FOREIGN_KEY_VIOLATION) {
            return {
                status: HttpStatus.CONFLICT,
                body: { message: 'Something this refers to is missing or still in use.', error: 'Conflict' },
            };
        }
        return { status: HttpStatus.INTERNAL_SERVER_ERROR, body: GENERIC_500 };
    }
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, body: GENERIC_500 };
}
const GENERIC_500 = {
    message: 'Something went wrong. Try again.',
    error: 'Internal Server Error',
};
//# sourceMappingURL=all-exceptions.filter.js.map