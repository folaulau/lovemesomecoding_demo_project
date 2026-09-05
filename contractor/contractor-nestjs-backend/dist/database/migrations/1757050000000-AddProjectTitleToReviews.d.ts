import type { MigrationInterface, QueryRunner } from 'typeorm';
export declare class AddProjectTitleToReviews1757050000000 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
