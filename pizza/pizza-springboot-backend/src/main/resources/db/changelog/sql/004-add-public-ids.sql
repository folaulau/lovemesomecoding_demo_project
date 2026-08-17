--liquibase formatted sql

-- Adds a UUID `public_id` to every table.
--
-- WHY BOTH IDENTIFIERS?
--   * `id` (BIGINT) stays the primary key and the target of every foreign key. It is compact,
--     sequential, and keeps InnoDB's clustered index tidy — random UUIDs as a clustered PK cause
--     page splits and index fragmentation.
--   * `public_id` (CHAR(36)) is the ONLY identifier the API exposes. Sequential ids let anyone
--     walk /api/orders/1, /2, /3 and read other people's orders; a UUID cannot be guessed.
--
-- Existing rows are backfilled deterministically from their numeric id, so the seeded demo data
-- has stable, greppable UUIDs that tests and frontend mocks can rely on. Rows created at runtime
-- get a real random UUID from the entity instead — see the @PrePersist hooks.
--
-- A NOTE ON THE FORMAT: 8-4-4-4-12 hex characters. The per-table prefix (aaaaaaaa, bbbbbbbb, ...)
-- is a readability trick for this demo only — real UUIDs carry no such meaning.

--changeset pizza:300-add-public-id-columns
--comment Nullable first, so existing rows can be backfilled before the NOT NULL constraint lands
ALTER TABLE product            ADD COLUMN public_id CHAR(36) NULL;
ALTER TABLE product_size       ADD COLUMN public_id CHAR(36) NULL;
ALTER TABLE crust              ADD COLUMN public_id CHAR(36) NULL;
ALTER TABLE topping            ADD COLUMN public_id CHAR(36) NULL;
ALTER TABLE app_user           ADD COLUMN public_id CHAR(36) NULL;
ALTER TABLE customer_order     ADD COLUMN public_id CHAR(36) NULL;
ALTER TABLE order_item         ADD COLUMN public_id CHAR(36) NULL;
ALTER TABLE order_item_topping ADD COLUMN public_id CHAR(36) NULL;
--rollback ALTER TABLE product DROP COLUMN public_id;
--rollback ALTER TABLE product_size DROP COLUMN public_id;
--rollback ALTER TABLE crust DROP COLUMN public_id;
--rollback ALTER TABLE topping DROP COLUMN public_id;
--rollback ALTER TABLE app_user DROP COLUMN public_id;
--rollback ALTER TABLE customer_order DROP COLUMN public_id;
--rollback ALTER TABLE order_item DROP COLUMN public_id;
--rollback ALTER TABLE order_item_topping DROP COLUMN public_id;

--changeset pizza:301-backfill-public-ids
--comment Deterministic UUIDs derived from the numeric id, so demo data is stable across rebuilds
UPDATE product            SET public_id = CONCAT('aaaaaaaa-0000-4000-8000-', LPAD(id, 12, '0'));
UPDATE product_size       SET public_id = CONCAT('a5a5a5a5-0000-4000-8000-', LPAD(id, 12, '0'));
UPDATE crust              SET public_id = CONCAT('cccccccc-0000-4000-8000-', LPAD(id, 12, '0'));
UPDATE topping            SET public_id = CONCAT('bbbbbbbb-0000-4000-8000-', LPAD(id, 12, '0'));
UPDATE app_user           SET public_id = CONCAT('dddddddd-0000-4000-8000-', LPAD(id, 12, '0'));
UPDATE customer_order     SET public_id = CONCAT('eeeeeeee-0000-4000-8000-', LPAD(id, 12, '0'));
UPDATE order_item         SET public_id = CONCAT('ffffffff-0000-4000-8000-', LPAD(id, 12, '0'));
UPDATE order_item_topping SET public_id = CONCAT('f0f0f0f0-0000-4000-8000-', LPAD(id, 12, '0'));
--rollback SELECT 1;

--changeset pizza:302-enforce-public-id
--comment NOT NULL + UNIQUE. The unique index is also what makes lookup-by-UUID fast.
ALTER TABLE product            MODIFY public_id CHAR(36) NOT NULL;
ALTER TABLE product_size       MODIFY public_id CHAR(36) NOT NULL;
ALTER TABLE crust              MODIFY public_id CHAR(36) NOT NULL;
ALTER TABLE topping            MODIFY public_id CHAR(36) NOT NULL;
ALTER TABLE app_user           MODIFY public_id CHAR(36) NOT NULL;
ALTER TABLE customer_order     MODIFY public_id CHAR(36) NOT NULL;
ALTER TABLE order_item         MODIFY public_id CHAR(36) NOT NULL;
ALTER TABLE order_item_topping MODIFY public_id CHAR(36) NOT NULL;

ALTER TABLE product            ADD CONSTRAINT uk_product_public_id UNIQUE (public_id);
ALTER TABLE product_size       ADD CONSTRAINT uk_product_size_public_id UNIQUE (public_id);
ALTER TABLE crust              ADD CONSTRAINT uk_crust_public_id UNIQUE (public_id);
ALTER TABLE topping            ADD CONSTRAINT uk_topping_public_id UNIQUE (public_id);
ALTER TABLE app_user           ADD CONSTRAINT uk_app_user_public_id UNIQUE (public_id);
ALTER TABLE customer_order     ADD CONSTRAINT uk_customer_order_public_id UNIQUE (public_id);
ALTER TABLE order_item         ADD CONSTRAINT uk_order_item_public_id UNIQUE (public_id);
ALTER TABLE order_item_topping ADD CONSTRAINT uk_oit_public_id UNIQUE (public_id);
--rollback SELECT 1;
