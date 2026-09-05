var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware.js';
import { loadConfig } from './config/configuration.js';
import { ContractorsModule } from './contractors/contractors.module.js';
import { buildDataSourceOptions } from './database/data-source.js';
import { ProjectsModule } from './projects/projects.module.js';
import { QuotesModule } from './quotes/quotes.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
let AppModule = class AppModule {
    configure(consumer) {
        consumer.apply(RequestIdMiddleware).forRoutes('*');
    }
};
AppModule = __decorate([
    Module({
        imports: [
            ConfigModule.forRoot({
                isGlobal: true,
                load: [loadConfig],
                envFilePath: ['.env'],
            }),
            TypeOrmModule.forRoot(buildDataSourceOptions()),
            AuthModule,
            ContractorsModule,
            ProjectsModule,
            QuotesModule,
            ReviewsModule,
        ],
        providers: [
            { provide: APP_FILTER, useClass: AllExceptionsFilter },
            { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
        ],
    })
], AppModule);
export { AppModule };
//# sourceMappingURL=app.module.js.map