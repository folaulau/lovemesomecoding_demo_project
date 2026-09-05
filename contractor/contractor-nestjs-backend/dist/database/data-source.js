import { DataSource } from 'typeorm';
import { loadConfig } from '../config/configuration.js';
import { ContractorProfile } from './entities/contractor-profile.entity.js';
import { PortfolioImage } from './entities/portfolio-image.entity.js';
import { Project } from './entities/project.entity.js';
import { Quote } from './entities/quote.entity.js';
import { Review } from './entities/review.entity.js';
import { ServiceCategory } from './entities/service-category.entity.js';
import { User } from './entities/user.entity.js';
import { InitialSchema1757030000000 } from './migrations/1757030000000-InitialSchema.js';
import { RenameAdminRoleToStaff1757040000000 } from './migrations/1757040000000-RenameAdminRoleToStaff.js';
import { AddProjectTitleToReviews1757050000000 } from './migrations/1757050000000-AddProjectTitleToReviews.js';
export const ENTITIES = [
    User,
    ContractorProfile,
    ServiceCategory,
    PortfolioImage,
    Project,
    Quote,
    Review,
];
export function buildDataSourceOptions() {
    const config = loadConfig();
    return {
        type: 'postgres',
        host: config.database.host,
        port: config.database.port,
        username: config.database.username,
        password: config.database.password,
        database: config.database.database,
        entities: ENTITIES,
        migrations: [
            InitialSchema1757030000000,
            RenameAdminRoleToStaff1757040000000,
            AddProjectTitleToReviews1757050000000,
        ],
        synchronize: false,
        migrationsRun: false,
        logging: ['error', 'warn', 'migration'],
    };
}
export default new DataSource(buildDataSourceOptions());
//# sourceMappingURL=data-source.js.map