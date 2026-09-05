import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'
import { TypeOrmModule } from '@nestjs/typeorm'

import { AuthModule } from './auth/auth.module.js'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js'
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js'
import { RequestIdMiddleware } from './common/middleware/request-id.middleware.js'
import { loadConfig } from './config/configuration.js'
import { ContractorsModule } from './contractors/contractors.module.js'
import { buildDataSourceOptions } from './database/data-source.js'
import { ProjectsModule } from './projects/projects.module.js'
import { QuotesModule } from './quotes/quotes.module.js'
import { ReviewsModule } from './reviews/reviews.module.js'

@Module({
  imports: [
    ConfigModule.forRoot({
      // Global, so no feature module has to import ConfigModule to inject ConfigService.
      isGlobal: true,
      // ⚠️ `load` with a factory, rather than letting ConfigModule hand out raw strings from
      // process.env. Everything the app reads is parsed and typed once, in configuration.ts.
      load: [loadConfig],
      // `.env` is gitignored and optional — the defaults in configuration.ts are the local ones,
      // so `npm run start:dev` works on a fresh clone with no file to create first.
      envFilePath: ['.env'],
    }),

    // ⚠️ The SAME options object the TypeORM CLI uses for migrations. Two configurations — one
    // here and one in data-source.ts — is how an app ends up running against a schema its
    // migrations never produced.
    TypeOrmModule.forRoot(buildDataSourceOptions()),

    AuthModule,
    ContractorsModule,
    ProjectsModule,
    QuotesModule,
    ReviewsModule,
  ],
  providers: [
    /**
     * ⚠️ Bound with `APP_FILTER` and `APP_INTERCEPTOR` rather than with `app.useGlobalFilters()`
     * in main.ts, and the difference is not style.
     *
     * A global bound on the app instance is constructed OUTSIDE the DI container — it can be given
     * dependencies only by hand, with `new`. Bound as a provider here, it is an ordinary member of
     * the graph: it can inject `ConfigService`, and Nest manages its lifecycle.
     *
     * The other half matters more for this repo. A `Test.createTestingModule({ imports: [AppModule] })`
     * picks these up automatically, because they are part of the module — while anything registered
     * on the app instance in `main.ts` has to be repeated in every test's bootstrap, and the day
     * somebody forgets, the suite is testing a pipeline the production app does not have.
     * `test/rules.e2e-spec.ts` still repeats the pipes for exactly that reason; these two do not
     * need repeating.
     */
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule implements NestModule {
  /**
   * ⚠️ Middleware is the ONE part of the pipeline that cannot be bound with a provider token.
   * There is no `APP_MIDDLEWARE`, because middleware is not resolved per request out of the
   * container — it is handed to the underlying Express app at startup, against routes. So it is
   * configured here, imperatively, and the route pattern is part of the registration.
   */
  configure(consumer: MiddlewareConsumer): void {
    // `'*'` — every route, including the ones that will 401 in a guard and the static `/uploads`
    // handler. An id on the failures is the reason this runs at all.
    consumer.apply(RequestIdMiddleware).forRoutes('*')
  }
}
