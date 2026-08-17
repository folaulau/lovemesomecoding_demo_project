--liquibase formatted sql

-- Server-side carts, so a refresh (or a different tab) does not lose what the customer built.
--
-- WHAT IS *NOT* STORED HERE: prices.
-- A cart row records only WHICH product, size, crust and toppings were chosen. Every figure is
-- recomputed from the catalogue when the cart is read, exactly as it is at checkout. That means a
-- cart left overnight picks up today's menu prices instead of quietly honouring yesterday's — and
-- it keeps a single source of pricing truth (PricingService), rather than a second one that can
-- drift.
--
-- Contrast this with `order_item`, which DOES snapshot prices: an order is a historical record of
-- what someone actually paid, whereas a cart is just an intention.

--changeset pizza:600-create-cart
--comment user_id is nullable: a guest cart belongs to a browser, not an account
CREATE TABLE cart (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    public_id  CHAR(36)    NOT NULL,
    user_id    BIGINT      NULL,
    order_type VARCHAR(20) NOT NULL DEFAULT 'DELIVERY',
    deleted    BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    CONSTRAINT uk_cart_public_id UNIQUE (public_id),
    CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE SET NULL
);
CREATE INDEX idx_cart_user ON cart (user_id);
CREATE INDEX idx_cart_updated_at ON cart (updated_at);
--rollback DROP TABLE cart;

--changeset pizza:601-create-cart-item
--comment Identifiers only — no prices. See the note at the top of this file.
CREATE TABLE cart_item (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    public_id  CHAR(36)    NOT NULL,
    cart_id    BIGINT      NOT NULL,
    product_id BIGINT      NOT NULL,
    size       VARCHAR(20) NOT NULL,
    crust_id   BIGINT      NULL,
    quantity   INT         NOT NULL,
    deleted    BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    CONSTRAINT uk_cart_item_public_id UNIQUE (public_id),
    CONSTRAINT fk_cart_item_cart FOREIGN KEY (cart_id) REFERENCES cart (id) ON DELETE CASCADE,
    CONSTRAINT fk_cart_item_product FOREIGN KEY (product_id) REFERENCES product (id) ON DELETE CASCADE,
    CONSTRAINT fk_cart_item_crust FOREIGN KEY (crust_id) REFERENCES crust (id) ON DELETE SET NULL
);
CREATE INDEX idx_cart_item_cart ON cart_item (cart_id);
--rollback DROP TABLE cart_item;

--changeset pizza:602-create-cart-item-topping
CREATE TABLE cart_item_topping (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    public_id    CHAR(36)    NOT NULL,
    cart_item_id BIGINT      NOT NULL,
    topping_id   BIGINT      NOT NULL,
    deleted      BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at   DATETIME(6) NOT NULL,
    updated_at   DATETIME(6) NOT NULL,
    CONSTRAINT uk_cart_item_topping_public_id UNIQUE (public_id),
    CONSTRAINT fk_cit_cart_item FOREIGN KEY (cart_item_id) REFERENCES cart_item (id) ON DELETE CASCADE,
    CONSTRAINT fk_cit_topping FOREIGN KEY (topping_id) REFERENCES topping (id) ON DELETE CASCADE,
    CONSTRAINT uk_cart_item_topping UNIQUE (cart_item_id, topping_id)
);
--rollback DROP TABLE cart_item_topping;
