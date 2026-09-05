export class RenameAdminRoleToStaff1757040000000 {
    name = 'RenameAdminRoleToStaff1757040000000';
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "ck_users_role"`);
        await queryRunner.query(`UPDATE "users" SET "role" = 'staff' WHERE "role" = 'admin'`);
        await queryRunner.query(`
      ALTER TABLE "users" ADD CONSTRAINT "ck_users_role"
        CHECK ("role" IN ('homeowner', 'contractor', 'staff'))
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "ck_users_role"`);
        await queryRunner.query(`UPDATE "users" SET "role" = 'admin' WHERE "role" = 'staff'`);
        await queryRunner.query(`
      ALTER TABLE "users" ADD CONSTRAINT "ck_users_role"
        CHECK ("role" IN ('homeowner', 'contractor', 'admin'))
    `);
    }
}
//# sourceMappingURL=1757040000000-RenameAdminRoleToStaff.js.map