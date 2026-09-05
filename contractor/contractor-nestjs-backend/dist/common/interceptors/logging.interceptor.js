var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable, Logger } from '@nestjs/common';
import { tap } from 'rxjs/operators';
import { requestIdOf } from '../middleware/request-id.middleware.js';
let LoggingInterceptor = class LoggingInterceptor {
    logger = new Logger('HTTP');
    intercept(context, next) {
        if (context.getType() !== 'http')
            return next.handle();
        const http = context.switchToHttp();
        const request = http.getRequest();
        const response = http.getResponse();
        const startedAt = Date.now();
        const handler = `${context.getClass().name}.${context.getHandler().name}`;
        const write = (status, error) => {
            const line = `${request.method} ${request.originalUrl} ${status} ${Date.now() - startedAt}ms ` +
                `${handler} req=${requestIdOf(request)} user=${request.user?.publicId ?? 'anon'}`;
            if (status >= 500)
                this.logger.error(line, error instanceof Error ? error.stack : undefined);
            else if (status >= 400)
                this.logger.warn(line);
            else
                this.logger.log(line);
        };
        return next.handle().pipe(tap({
            next: () => write(response.statusCode),
            error: (error) => write(statusOf(error), error),
        }));
    }
};
LoggingInterceptor = __decorate([
    Injectable()
], LoggingInterceptor);
export { LoggingInterceptor };
function statusOf(error) {
    const status = error?.getStatus;
    return typeof status === 'function' ? status.call(error) : 500;
}
//# sourceMappingURL=logging.interceptor.js.map