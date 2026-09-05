import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'

import { AuthModule } from './auth/auth.module.js'
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
})
export class AppModule {}
