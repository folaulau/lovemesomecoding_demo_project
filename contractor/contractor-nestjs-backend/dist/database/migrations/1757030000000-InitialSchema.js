export class InitialSchema1757030000000 {
    name = 'InitialSchema1757030000000';
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE "users" (
        "id"            BIGSERIAL     PRIMARY KEY,
        "public_id"     UUID          NOT NULL DEFAULT gen_random_uuid(),
        "email"         VARCHAR(255)  NOT NULL,
        "password_hash" VARCHAR(72)   NOT NULL,
        "first_name"    VARCHAR(80)   NOT NULL,
        "last_name"     VARCHAR(80)   NOT NULL,
        "phone"         VARCHAR(40),
        "role"          VARCHAR(20)   NOT NULL,
        "avatar_url"    VARCHAR(500),
        "deleted"       BOOLEAN       NOT NULL DEFAULT false,
        "created_at"    TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "updated_at"    TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "uq_users_public_id" UNIQUE ("public_id"),
        CONSTRAINT "uq_users_email"     UNIQUE ("email"),
        -- The role is checked in the database as well as in the DTO. The DTO protects the API;
        -- this protects the TABLE, which the seed script also writes to.
        CONSTRAINT "ck_users_role" CHECK ("role" IN ('homeowner', 'contractor', 'admin'))
      )
    `);
        await queryRunner.query(`
      CREATE TABLE "service_categories" (
        "id"          BIGSERIAL     PRIMARY KEY,
        "public_id"   UUID          NOT NULL DEFAULT gen_random_uuid(),
        "slug"        VARCHAR(60)   NOT NULL,
        "name"        VARCHAR(80)   NOT NULL,
        "description" VARCHAR(300)  NOT NULL,
        "icon"        VARCHAR(8)    NOT NULL,
        "created_at"  TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "uq_service_categories_public_id" UNIQUE ("public_id"),
        CONSTRAINT "uq_service_categories_slug"      UNIQUE ("slug")
      )
    `);
        await queryRunner.query(`
      CREATE TABLE "contractor_profiles" (
        "id"                   BIGSERIAL     PRIMARY KEY,
        "public_id"            UUID          NOT NULL DEFAULT gen_random_uuid(),
        "user_id"              BIGINT        NOT NULL,
        "business_name"        VARCHAR(160)  NOT NULL,
        "bio"                  TEXT          NOT NULL DEFAULT '',
        "years_in_business"    INT           NOT NULL DEFAULT 0,
        "license_number"       VARCHAR(60),
        "city"                 VARCHAR(100)  NOT NULL DEFAULT '',
        "state"                VARCHAR(2)    NOT NULL DEFAULT '',
        "zip"                  VARCHAR(10)   NOT NULL DEFAULT '',
        "service_radius_miles" INT           NOT NULL DEFAULT 25,
        -- ⚠️ numeric, not float. Binary floating point cannot represent 0.1, so money in a double
        -- accumulates error that shows up as an invoice that is a cent off and cannot be explained.
        "hourly_rate_min"      NUMERIC(10,2) NOT NULL DEFAULT 0,
        "hourly_rate_max"      NUMERIC(10,2) NOT NULL DEFAULT 0,
        -- Cached aggregates, recomputed from "reviews" by the backend. Never written by a client.
        "rating_average"       NUMERIC(3,2)  NOT NULL DEFAULT 0,
        "review_count"         INT           NOT NULL DEFAULT 0,
        "deleted"              BOOLEAN       NOT NULL DEFAULT false,
        "created_at"           TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "updated_at"           TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "uq_contractor_profiles_public_id" UNIQUE ("public_id"),
        -- One profile per user. This is what makes the relation a true one-to-one rather than a
        -- one-to-many that everybody agrees to only put one row in.
        CONSTRAINT "uq_contractor_profiles_user_id"   UNIQUE ("user_id"),
        CONSTRAINT "fk_contractor_profiles_user"
          FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "ck_contractor_profiles_rate_order"
          CHECK ("hourly_rate_max" >= "hourly_rate_min")
      )
    `);
        await queryRunner.query(`
      CREATE TABLE "contractor_services" (
        "contractor_profile_id" BIGINT NOT NULL,
        "service_category_id"   BIGINT NOT NULL,
        -- The composite primary key IS the uniqueness rule: a pro cannot list the same trade twice.
        -- A surrogate id here would add a column and remove that guarantee.
        CONSTRAINT "pk_contractor_services"
          PRIMARY KEY ("contractor_profile_id", "service_category_id"),
        CONSTRAINT "fk_contractor_services_profile"
          FOREIGN KEY ("contractor_profile_id") REFERENCES "contractor_profiles" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_contractor_services_category"
          FOREIGN KEY ("service_category_id") REFERENCES "service_categories" ("id") ON DELETE CASCADE
      )
    `);
        await queryRunner.query(`
      CREATE INDEX "ix_contractor_services_category"
        ON "contractor_services" ("service_category_id")
    `);
        await queryRunner.query(`
      CREATE TABLE "portfolio_images" (
        "id"                    BIGSERIAL     PRIMARY KEY,
        "public_id"             UUID          NOT NULL DEFAULT gen_random_uuid(),
        "contractor_profile_id" BIGINT        NOT NULL,
        "url"                   VARCHAR(500)  NOT NULL,
        "caption"               VARCHAR(200),
        "sort_order"            INT           NOT NULL DEFAULT 0,
        "created_at"            TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "updated_at"            TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "uq_portfolio_images_public_id" UNIQUE ("public_id"),
        CONSTRAINT "fk_portfolio_images_profile"
          FOREIGN KEY ("contractor_profile_id") REFERENCES "contractor_profiles" ("id") ON DELETE CASCADE
      )
    `);
        await queryRunner.query(`
      CREATE INDEX "ix_portfolio_images_profile_sort"
        ON "portfolio_images" ("contractor_profile_id", "sort_order")
    `);
        await queryRunner.query(`
      CREATE TABLE "projects" (
        "id"                   BIGSERIAL     PRIMARY KEY,
        "public_id"            UUID          NOT NULL DEFAULT gen_random_uuid(),
        "homeowner_id"         BIGINT        NOT NULL,
        "service_category_id"  BIGINT        NOT NULL,
        "title"                VARCHAR(160)  NOT NULL,
        "description"          TEXT          NOT NULL,
        "city"                 VARCHAR(100)  NOT NULL,
        "state"                VARCHAR(2)    NOT NULL,
        "zip"                  VARCHAR(10)   NOT NULL,
        "budget_min"           NUMERIC(12,2) NOT NULL,
        "budget_max"           NUMERIC(12,2) NOT NULL,
        -- ⚠️ DATE, not TIMESTAMPTZ. The homeowner picks a day; a day has no time and no zone, and
        -- forcing one on it is how "September 10th" renders as the 9th for half the country.
        "preferred_start_date" DATE          NOT NULL,
        "status"               VARCHAR(20)   NOT NULL DEFAULT 'open',
        "created_at"           TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "updated_at"           TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "uq_projects_public_id" UNIQUE ("public_id"),
        CONSTRAINT "fk_projects_homeowner"
          FOREIGN KEY ("homeowner_id") REFERENCES "users" ("id"),
        CONSTRAINT "fk_projects_category"
          FOREIGN KEY ("service_category_id") REFERENCES "service_categories" ("id"),
        CONSTRAINT "ck_projects_status"
          CHECK ("status" IN ('open', 'quoted', 'hired', 'in_progress', 'completed', 'cancelled')),
        CONSTRAINT "ck_projects_budget_order" CHECK ("budget_max" >= "budget_min")
      )
    `);
        await queryRunner.query(`
      CREATE INDEX "ix_projects_status_category_created"
        ON "projects" ("status", "service_category_id", "created_at" DESC)
    `);
        await queryRunner.query(`
      CREATE INDEX "ix_projects_homeowner_created"
        ON "projects" ("homeowner_id", "created_at" DESC)
    `);
        await queryRunner.query(`
      CREATE TABLE "quotes" (
        "id"                    BIGSERIAL     PRIMARY KEY,
        "public_id"             UUID          NOT NULL DEFAULT gen_random_uuid(),
        "project_id"            BIGINT        NOT NULL,
        "contractor_profile_id" BIGINT        NOT NULL,
        "amount"                NUMERIC(12,2) NOT NULL,
        "estimated_days"        INT           NOT NULL,
        "message"               TEXT          NOT NULL DEFAULT '',
        "status"                VARCHAR(20)   NOT NULL DEFAULT 'pending',
        "created_at"            TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "updated_at"            TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "uq_quotes_public_id" UNIQUE ("public_id"),
        -- ⚠️ One quote per contractor per project. QuotesService checks first and returns a clean
        -- 409, but two requests arriving together BOTH pass that check — only the constraint stops
        -- the second insert. An application-level uniqueness check is always a race; this is the
        -- actual guarantee.
        CONSTRAINT "uq_quote_per_contractor_per_project"
          UNIQUE ("project_id", "contractor_profile_id"),
        CONSTRAINT "fk_quotes_project"
          FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_quotes_contractor"
          FOREIGN KEY ("contractor_profile_id") REFERENCES "contractor_profiles" ("id"),
        CONSTRAINT "ck_quotes_status"
          CHECK ("status" IN ('pending', 'accepted', 'declined', 'withdrawn')),
        CONSTRAINT "ck_quotes_amount_positive" CHECK ("amount" > 0),
        CONSTRAINT "ck_quotes_days_positive"   CHECK ("estimated_days" >= 1)
      )
    `);
        await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_one_accepted_quote_per_project"
        ON "quotes" ("project_id") WHERE "status" = 'accepted'
    `);
        await queryRunner.query(`
      CREATE INDEX "ix_quotes_contractor_created"
        ON "quotes" ("contractor_profile_id", "created_at" DESC)
    `);
        await queryRunner.query(`
      CREATE TABLE "reviews" (
        "id"                    BIGSERIAL    PRIMARY KEY,
        "public_id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
        "project_id"            BIGINT       NOT NULL,
        "homeowner_id"          BIGINT       NOT NULL,
        "contractor_profile_id" BIGINT       NOT NULL,
        "rating"                INT          NOT NULL,
        "comment"               TEXT         NOT NULL DEFAULT '',
        "created_at"            TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"            TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "uq_reviews_public_id" UNIQUE ("public_id"),
        -- One review per project, forever.
        CONSTRAINT "uq_reviews_project" UNIQUE ("project_id"),
        CONSTRAINT "fk_reviews_project"
          FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_reviews_homeowner"
          FOREIGN KEY ("homeowner_id") REFERENCES "users" ("id"),
        CONSTRAINT "fk_reviews_contractor"
          FOREIGN KEY ("contractor_profile_id") REFERENCES "contractor_profiles" ("id"),
        -- A rating of 7 here would corrupt a contractor's average with nothing to say which row
        -- did it. The DTO checks this too; this is the copy that also covers the seed and psql.
        CONSTRAINT "ck_review_rating_range" CHECK ("rating" >= 1 AND "rating" <= 5)
      )
    `);
        await queryRunner.query(`
      CREATE INDEX "ix_reviews_contractor_created"
        ON "reviews" ("contractor_profile_id", "created_at" DESC)
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE "reviews"`);
        await queryRunner.query(`DROP TABLE "quotes"`);
        await queryRunner.query(`DROP TABLE "projects"`);
        await queryRunner.query(`DROP TABLE "portfolio_images"`);
        await queryRunner.query(`DROP TABLE "contractor_services"`);
        await queryRunner.query(`DROP TABLE "contractor_profiles"`);
        await queryRunner.query(`DROP TABLE "service_categories"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }
}
//# sourceMappingURL=1757030000000-InitialSchema.js.map