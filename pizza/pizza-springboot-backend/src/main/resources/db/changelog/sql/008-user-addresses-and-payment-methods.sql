--liquibase formatted sql

-- Saved addresses and saved payment methods, both belonging to a user account.
--
-- ============================================================================
-- ⚠️  READ THIS BEFORE ADDING COLUMNS TO user_payment_method
-- ============================================================================
-- There is NO card number here, no CVC, and no cardholder name. Storing a PAN puts an application
-- squarely inside PCI-DSS scope, and there is no reason to: Stripe already holds the card and
-- hands back an opaque token.
--
-- What is stored is:
--   * stripe_payment_method_id — an opaque "pm_..." token. Useless to anyone without our secret key.
--   * brand / last4 / exp_month / exp_year — DISPLAY metadata only, returned by Stripe itself,
--     so the customer can recognise "Visa ending 4242" in a list.
--
-- The card details themselves never touch this application, let alone this database.
-- ============================================================================

--changeset pizza:700-add-stripe-customer-id
--comment Links our user to a Stripe Customer, which is what payment methods attach to
ALTER TABLE app_user ADD COLUMN stripe_customer_id VARCHAR(120) NULL;
CREATE INDEX idx_app_user_stripe_customer ON app_user (stripe_customer_id);
--rollback ALTER TABLE app_user DROP COLUMN stripe_customer_id;

--changeset pizza:701-create-user-address
--comment Guests do not get rows here — a guest types their address onto the order itself
CREATE TABLE user_address (
    id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    public_id      CHAR(36)     NOT NULL,
    user_id        BIGINT       NOT NULL,
    label          VARCHAR(60)  NULL COMMENT 'Home, Work, ... purely for the customer',
    recipient_name VARCHAR(150) NULL,
    phone          VARCHAR(40)  NULL,
    line1          VARCHAR(200) NOT NULL,
    line2          VARCHAR(200) NULL,
    city           VARCHAR(100) NOT NULL,
    state          VARCHAR(50)  NOT NULL,
    postal_code    VARCHAR(20)  NOT NULL,
    is_primary     BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted        BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at     DATETIME(6)  NOT NULL,
    updated_at     DATETIME(6)  NOT NULL,
    CONSTRAINT uk_user_address_public_id UNIQUE (public_id),
    CONSTRAINT fk_user_address_user FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE
);
CREATE INDEX idx_user_address_user ON user_address (user_id);
--rollback DROP TABLE user_address;

--changeset pizza:702-create-user-payment-method
--comment Tokens and display metadata only. See the warning at the top of this file.
CREATE TABLE user_payment_method (
    id                       BIGINT AUTO_INCREMENT PRIMARY KEY,
    public_id                CHAR(36)     NOT NULL,
    user_id                  BIGINT       NOT NULL,
    stripe_payment_method_id VARCHAR(120) NOT NULL COMMENT 'Opaque pm_... token from Stripe',
    brand                    VARCHAR(40)  NULL COMMENT 'visa, mastercard, ... for display',
    last4                    CHAR(4)      NULL COMMENT 'Display only. NOT the card number.',
    exp_month                INT          NULL,
    exp_year                 INT          NULL,
    is_primary               BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted                  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at               DATETIME(6)  NOT NULL,
    updated_at               DATETIME(6)  NOT NULL,
    CONSTRAINT uk_user_payment_method_public_id UNIQUE (public_id),
    CONSTRAINT uk_user_payment_method_token UNIQUE (user_id, stripe_payment_method_id),
    CONSTRAINT fk_user_payment_method_user FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE
);
CREATE INDEX idx_user_payment_method_user ON user_payment_method (user_id);
--rollback DROP TABLE user_payment_method;

--changeset pizza:703-seed-demo-addresses
--comment Two addresses for the demo customer so the chooser has something to show
INSERT INTO user_address
    (public_id, user_id, label, recipient_name, phone, line1, city, state, postal_code,
     is_primary, created_at, updated_at)
VALUES
    ('a11a11a1-0000-4000-8000-000000000001', 2, 'Home', 'Demo Customer', '801-555-0101',
     '123 Main St', 'Salt Lake City', 'UT', '84101', TRUE,
     '2026-01-01 00:00:00.000000', '2026-01-01 00:00:00.000000'),
    ('a11a11a1-0000-4000-8000-000000000002', 2, 'Work', 'Demo Customer', '801-555-0102',
     '400 Office Park', 'Sandy', 'UT', '84070', FALSE,
     '2026-01-01 00:00:00.000000', '2026-01-01 00:00:00.000000');
--rollback DELETE FROM user_address;
