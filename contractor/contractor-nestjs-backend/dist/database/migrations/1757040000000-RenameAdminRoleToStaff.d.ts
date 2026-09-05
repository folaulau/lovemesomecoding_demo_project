import type { MigrationInterface, QueryRunner } from 'typeorm';
export declare class RenameAdminRoleToStaff1757040000000 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
