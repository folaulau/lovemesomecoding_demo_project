--liquibase formatted sql

-- =============================================================================
-- Catalog
-- =============================================================================

--changeset pizza:001-create-product
--comment Pizzas and drinks share one table, separated by `type`
CREATE TABLE product (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(120) NOT NULL,
    description   VARCHAR(500),
    type          VARCHAR(20)  NOT NULL COMMENT 'PIZZA or DRINK',
    image_url     VARCHAR(500),
    active        BOOLEAN      NOT NULL DEFAULT TRUE,
    display_order INT          NOT NULL DEFAULT 0,
    created_at    DATETIME(6)  NOT NULL,
    CONSTRAINT uk_product_name UNIQUE (name)
);
CREATE INDEX idx_product_type_active ON product (type, active);
--rollback DROP TABLE product;

--changeset pizza:002-create-product-size
--comment One price per size. A drink uses the same sizes, which keeps pricing uniform.
CREATE TABLE product_size (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT         NOT NULL,
    size       VARCHAR(20)    NOT NULL COMMENT 'SMALL, MEDIUM or LARGE',
    price      DECIMAL(10, 2) NOT NULL,
    CONSTRAINT fk_product_size_product FOREIGN KEY (product_id) REFERENCES product (id) ON DELETE CASCADE,
    CONSTRAINT uk_product_size UNIQUE (product_id, size)
);
--rollback DROP TABLE product_size;

--changeset pizza:003-create-crust
CREATE TABLE crust (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(80)    NOT NULL,
    price_delta   DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT 'Added on top of the size price',
    active        BOOLEAN        NOT NULL DEFAULT TRUE,
    display_order INT            NOT NULL DEFAULT 0,
    CONSTRAINT uk_crust_name UNIQUE (name)
);
--rollback DROP TABLE crust;

--changeset pizza:004-create-topping
CREATE TABLE topping (
    id       BIGINT AUTO_INCREMENT PRIMARY KEY,
    name     VARCHAR(80)    NOT NULL,
    price    DECIMAL(10, 2) NOT NULL,
    category VARCHAR(20)    NOT NULL COMMENT 'MEAT, VEGGIE or CHEESE',
    active   BOOLEAN        NOT NULL DEFAULT TRUE,
    CONSTRAINT uk_topping_name UNIQUE (name)
);
--rollback DROP TABLE topping;

-- =============================================================================
-- Users
-- =============================================================================

--changeset pizza:005-create-app-user
--comment Named app_user because `user` is a keyword in MySQL
CREATE TABLE app_user (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    email         VARCHAR(180) NOT NULL,
    password_hash VARCHAR(100) NOT NULL COMMENT 'BCrypt, 60 chars, padded for algorithm changes',
    full_name     VARCHAR(150),
    role          VARCHAR(20)  NOT NULL COMMENT 'CUSTOMER or ADMIN',
    created_at    DATETIME(6)  NOT NULL,
    CONSTRAINT uk_app_user_email UNIQUE (email)
);
--rollback DROP TABLE app_user;

-- =============================================================================
-- Orders
-- =============================================================================

--changeset pizza:006-create-customer-order
--comment Named customer_order because `order` is reserved in SQL.
--comment user_id is nullable on purpose: that is what makes guest checkout work.
CREATE TABLE customer_order (
    id                       BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id                  BIGINT       NULL COMMENT 'NULL for a guest order',
    guest_email              VARCHAR(180) NULL,
    customer_name            VARCHAR(150) NOT NULL,
    phone                    VARCHAR(40),
    order_type               VARCHAR(20)  NOT NULL COMMENT 'DELIVERY or CARRYOUT',
    status                   VARCHAR(30)  NOT NULL,
    address_line1            VARCHAR(200),
    address_line2            VARCHAR(200),
    city                     VARCHAR(100),
    state                    VARCHAR(50),
    postal_code              VARCHAR(20),
    subtotal                 DECIMAL(10, 2) NOT NULL,
    tax                      DECIMAL(10, 2) NOT NULL,
    delivery_fee             DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total                    DECIMAL(10, 2) NOT NULL,
    stripe_payment_intent_id VARCHAR(120),
    created_at               DATETIME(6)  NOT NULL,
    updated_at               DATETIME(6)  NOT NULL,
    CONSTRAINT fk_customer_order_user FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE SET NULL
);
CREATE INDEX idx_customer_order_created_at ON customer_order (created_at);
CREATE INDEX idx_customer_order_status ON customer_order (status);
CREATE INDEX idx_customer_order_user ON customer_order (user_id);
CREATE INDEX idx_customer_order_payment_intent ON customer_order (stripe_payment_intent_id);
--rollback DROP TABLE customer_order;

--changeset pizza:007-create-order-item
--comment product_name/crust_name/unit_price are SNAPSHOTS. Editing the menu later
--comment must not silently rewrite what a customer already bought.
CREATE TABLE order_item (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id     BIGINT         NOT NULL,
    product_id   BIGINT         NULL COMMENT 'NULL if the product was later deleted',
    product_name VARCHAR(120)   NOT NULL,
    size         VARCHAR(20)    NOT NULL,
    crust_id     BIGINT         NULL,
    crust_name   VARCHAR(80)    NULL,
    quantity     INT            NOT NULL,
    unit_price   DECIMAL(10, 2) NOT NULL COMMENT 'Base + crust + toppings, for ONE unit',
    line_total   DECIMAL(10, 2) NOT NULL COMMENT 'unit_price * quantity',
    CONSTRAINT fk_order_item_order FOREIGN KEY (order_id) REFERENCES customer_order (id) ON DELETE CASCADE,
    CONSTRAINT fk_order_item_product FOREIGN KEY (product_id) REFERENCES product (id) ON DELETE SET NULL,
    CONSTRAINT fk_order_item_crust FOREIGN KEY (crust_id) REFERENCES crust (id) ON DELETE SET NULL
);
CREATE INDEX idx_order_item_order ON order_item (order_id);
CREATE INDEX idx_order_item_product ON order_item (product_id);
--rollback DROP TABLE order_item;

--changeset pizza:008-create-order-item-topping
CREATE TABLE order_item_topping (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_item_id BIGINT         NOT NULL,
    topping_id    BIGINT         NULL,
    topping_name  VARCHAR(80)    NOT NULL,
    price         DECIMAL(10, 2) NOT NULL,
    CONSTRAINT fk_oit_order_item FOREIGN KEY (order_item_id) REFERENCES order_item (id) ON DELETE CASCADE,
    CONSTRAINT fk_oit_topping FOREIGN KEY (topping_id) REFERENCES topping (id) ON DELETE SET NULL
);
CREATE INDEX idx_oit_order_item ON order_item_topping (order_item_id);
--rollback DROP TABLE order_item_topping;
