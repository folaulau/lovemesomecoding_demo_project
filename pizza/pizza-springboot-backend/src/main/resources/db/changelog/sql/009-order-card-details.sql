--liquibase formatted sql

-- Records WHICH card paid for an order, so the confirmation page and the order history can show
-- "Visa ending 4242" rather than leaving the customer guessing.
--
-- The same rule as user_payment_method applies here: brand and last4 are DISPLAY metadata that
-- Stripe reports back to us. There is no card number, no CVC, and no token — an order only needs
-- to say which card was used, never to be able to charge it again.

--changeset pizza:800-add-order-card-details
ALTER TABLE customer_order
    ADD COLUMN card_brand VARCHAR(40) NULL COMMENT 'visa, mastercard, ... display only',
    ADD COLUMN card_last4 CHAR(4)    NULL COMMENT 'Display only. NOT the card number.';
--rollback ALTER TABLE customer_order DROP COLUMN card_brand, DROP COLUMN card_last4;
