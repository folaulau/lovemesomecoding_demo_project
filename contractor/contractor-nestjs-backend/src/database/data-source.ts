import { DataSource } from 'typeorm'
import type { DataSourceOptions } from 'typeorm'

import { loadConfig } from '../config/configuration.js'
import { ContractorProfile } from './entities/contractor-profile.entity.js'
import { PortfolioImage } from './entities/portfolio-image.entity.js'
import { Project } from './entities/project.entity.js'
import { Quote } from './entities/quote.entity.js'
import { Review } from './entities/review.entity.js'
import { ServiceCategory } from './entities/service-category.entity.js'
import { User } from './entities/user.entity.js'
import { InitialSchema1757030000000 } from './migrations/1757030000000-InitialSchema.js'
import { RenameAdminRoleToStaff1757040000000 } from './migrations/1757040000000-RenameAdminRoleToStaff.js'
import { AddProjectTitleToReviews1757050000000 } from './migrations/1757050000000-AddProjectTitleToReviews.js'

/**
 * The TypeORM configuration, in one place, used by two callers: `AppModule` at runtime and the
 * TypeORM CLI for migrations.
 *
 * ⚠️ Entities and migrations are listed as IMPORTED CLASSES, not as glob patterns like
 * `dist/**\/*.entity.js`. Globs are what every TypeORM tutorial shows and they do not work
 * reliably under ESM — the resolver is different, and the failure mode is not an error but an
 * empty entity list, which surfaces much later as "No metadata for User was found". Explicit
 * imports also mean a renamed file breaks the build instead of the app.
 */
export const ENTITIES = [
  User,
  ContractorProfile,
  ServiceCategory,
  PortfolioImage,
  Project,
  Quote,
  Review,
]

export function buildDataSourceOptions(): DataSourceOptions {
  const config = loadConfig()

  return {
    type: 'postgres',
    host: config.database.host,
    port: config.database.port,
    username: config.database.username,
    password: config.database.password,
    database: config.database.database,

    entities: ENTITIES,
    // ⚠️ ORDER MATTERS. TypeORM runs them in the order given, and the second one alters a
    // constraint the first one creates. The timestamp prefix on each class name is the
    // convention that makes the right order the obvious one.
    migrations: [
      InitialSchema1757030000000,
      RenameAdminRoleToStaff1757040000000,
      AddProjectTitleToReviews1757050000000,
    ],

    /**
     * ⚠️ `synchronize` is FALSE and must stay false.
     *
     * It is the single most tempting setting in TypeORM: turn it on and the schema appears from
     * the entities with no migration to write. It also silently drops columns it thinks are gone,
     * and it gives you no record of how the schema got to where it is. Migrations are the record.
     */
    synchronize: false,

    /**
     * Migrations are NOT run automatically at startup either. Two app instances booting together
     * would both try, and the loser fails on a half-applied schema. `npm run migration:run` is a
     * deliberate, single-threaded step.
     */
    migrationsRun: false,

    // 'error' rather than true: `true` logs every query and buries the one that matters. Turn it
    // up to ['query', 'error'] when you are actually debugging SQL.
    logging: ['error', 'warn', 'migration'],
  }
}

/**
 * The default export the TypeORM CLI looks for.
 *
 * ⚠️ The CLI runs against `dist/`, not `src/`. Under ESM there is no working `ts-node` loader for
 * decorators plus `emitDecoratorMetadata`, so the npm scripts build first and point the CLI at the
 * compiled file. See the migration commands in package.json.
 */
export default new DataSource(buildDataSourceOptions())
