export class AddProjectTitleToReviews1757050000000 {
    name = 'AddProjectTitleToReviews1757050000000';
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "reviews" ADD COLUMN "project_title" VARCHAR(160)`);
        await queryRunner.query(`
      UPDATE "reviews" r
      SET "project_title" = p."title"
      FROM "projects" p
      WHERE p."id" = r."project_id"
    `);
        await queryRunner.query(`ALTER TABLE "reviews" ALTER COLUMN "project_title" SET NOT NULL`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN "project_title"`);
    }
}
//# sourceMappingURL=1757050000000-AddProjectTitleToReviews.js.map