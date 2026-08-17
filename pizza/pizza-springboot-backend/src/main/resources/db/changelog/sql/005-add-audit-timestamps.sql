--liquibase formatted sql

-- Gives every table created_at / updated_at.
--
-- `product`, `app_user` and `customer_order` already had created_at from 001; only the missing
-- columns are added here, which is why the statements are not uniform.
--
-- Both are maintained by JPA lifecycle callbacks in BaseEntity (@PrePersist / @PreUpdate) rather
-- than by database DEFAULT/ON UPDATE clauses. One mechanism, visible in the Java, that behaves
-- identically on every database — instead of behaviour split between two places.

--changeset pizza:400-add-timestamp-columns
ALTER TABLE product            ADD COLUMN updated_at DATETIME(6) NULL;
ALTER TABLE app_user           ADD COLUMN updated_at DATETIME(6) NULL;

ALTER TABLE product_size       ADD COLUMN created_at DATETIME(6) NULL,
                               ADD COLUMN updated_at DATETIME(6) NULL;
ALTER TABLE crust              ADD COLUMN created_at DATETIME(6) NULL,
                               ADD COLUMN updated_at DATETIME(6) NULL;
ALTER TABLE topping            ADD COLUMN created_at DATETIME(6) NULL,
                               ADD COLUMN updated_at DATETIME(6) NULL;
ALTER TABLE order_item         ADD COLUMN created_at DATETIME(6) NULL,
                               ADD COLUMN updated_at DATETIME(6) NULL;
ALTER TABLE order_item_topping ADD COLUMN created_at DATETIME(6) NULL,
                               ADD COLUMN updated_at DATETIME(6) NULL;
--rollback ALTER TABLE product DROP COLUMN updated_at;
--rollback ALTER TABLE app_user DROP COLUMN updated_at;
--rollback ALTER TABLE product_size DROP COLUMN created_at, DROP COLUMN updated_at;
--rollback ALTER TABLE crust DROP COLUMN created_at, DROP COLUMN updated_at;
--rollback ALTER TABLE topping DROP COLUMN created_at, DROP COLUMN updated_at;
--rollback ALTER TABLE order_item DROP COLUMN created_at, DROP COLUMN updated_at;
--rollback ALTER TABLE order_item_topping DROP COLUMN created_at, DROP COLUMN updated_at;

--changeset pizza:401-backfill-timestamps
--comment Order lines inherit their parent order's timestamp, so the demo history stays coherent
UPDATE product      SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE app_user     SET updated_at = created_at WHERE updated_at IS NULL;

UPDATE product_size ps
    JOIN product p ON p.id = ps.product_id
    SET ps.created_at = p.created_at, ps.updated_at = p.created_at
    WHERE ps.created_at IS NULL;

UPDATE order_item i
    JOIN customer_order o ON o.id = i.order_id
    SET i.created_at = o.created_at, i.updated_at = o.created_at
    WHERE i.created_at IS NULL;

UPDATE order_item_topping t
    JOIN order_item i ON i.id = t.order_item_id
    SET t.created_at = i.created_at, t.updated_at = i.created_at
    WHERE t.created_at IS NULL;

UPDATE crust   SET created_at = '2026-01-01 00:00:00.000000', updated_at = '2026-01-01 00:00:00.000000' WHERE created_at IS NULL;
UPDATE topping SET created_at = '2026-01-01 00:00:00.000000', updated_at = '2026-01-01 00:00:00.000000' WHERE created_at IS NULL;
--rollback SELECT 1;

--changeset pizza:402-enforce-timestamps
ALTER TABLE product            MODIFY updated_at DATETIME(6) NOT NULL;
ALTER TABLE app_user           MODIFY updated_at DATETIME(6) NOT NULL;
ALTER TABLE product_size       MODIFY created_at DATETIME(6) NOT NULL, MODIFY updated_at DATETIME(6) NOT NULL;
ALTER TABLE crust              MODIFY created_at DATETIME(6) NOT NULL, MODIFY updated_at DATETIME(6) NOT NULL;
ALTER TABLE topping            MODIFY created_at DATETIME(6) NOT NULL, MODIFY updated_at DATETIME(6) NOT NULL;
ALTER TABLE order_item         MODIFY created_at DATETIME(6) NOT NULL, MODIFY updated_at DATETIME(6) NOT NULL;
ALTER TABLE order_item_topping MODIFY created_at DATETIME(6) NOT NULL, MODIFY updated_at DATETIME(6) NOT NULL;
--rollback SELECT 1;
