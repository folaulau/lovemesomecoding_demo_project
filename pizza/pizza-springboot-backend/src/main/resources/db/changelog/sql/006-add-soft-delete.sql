--liquibase formatted sql

-- Adds a `deleted` flag to every table, matching the trademachine convention.
--
-- `deleted` and `active` are NOT the same thing, and both are kept:
--   * active  = temporarily off the menu. Still visible and editable in the admin screen.
--   * deleted = gone for good. Filtered out of every query by @SQLRestriction on the entity.
--
-- Rows are never physically removed, because historical orders reference them.

--changeset pizza:500-add-deleted-flag
ALTER TABLE product            ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE product_size       ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE crust              ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE topping            ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE app_user           ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE customer_order     ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE order_item         ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE order_item_topping ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT FALSE;
--rollback ALTER TABLE product DROP COLUMN deleted;
--rollback ALTER TABLE product_size DROP COLUMN deleted;
--rollback ALTER TABLE crust DROP COLUMN deleted;
--rollback ALTER TABLE topping DROP COLUMN deleted;
--rollback ALTER TABLE app_user DROP COLUMN deleted;
--rollback ALTER TABLE customer_order DROP COLUMN deleted;
--rollback ALTER TABLE order_item DROP COLUMN deleted;
--rollback ALTER TABLE order_item_topping DROP COLUMN deleted;

--changeset pizza:501-index-deleted
--comment @SQLRestriction appends "deleted = false" to every query, so these columns are always filtered on
CREATE INDEX idx_product_deleted ON product (deleted);
CREATE INDEX idx_topping_deleted ON topping (deleted);
CREATE INDEX idx_crust_deleted ON crust (deleted);
CREATE INDEX idx_customer_order_deleted ON customer_order (deleted);
--rollback DROP INDEX idx_product_deleted ON product;
--rollback DROP INDEX idx_topping_deleted ON topping;
--rollback DROP INDEX idx_crust_deleted ON crust;
--rollback DROP INDEX idx_customer_order_deleted ON customer_order;
