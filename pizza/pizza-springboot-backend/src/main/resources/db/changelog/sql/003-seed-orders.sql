--liquibase formatted sql

-- Backdated demo orders. Without these the admin reports dashboard renders empty
-- axes, which makes it impossible to build or review. Dates are relative to when
-- this changeset runs, so the reports always show a populated recent window.
--
-- Amounts are deliberately inserted as zero and then derived from the line items
-- in changeset 203. That keeps subtotal == SUM(line_total) true by construction
-- instead of by careful typing.

--changeset pizza:200-seed-orders
--comment Order 5 is intentionally PENDING_PAYMENT and 9/14 CANCELLED so the
--comment status breakdown report has more than one slice.
INSERT INTO customer_order
    (id, user_id, guest_email, customer_name, phone, order_type, status,
     address_line1, city, state, postal_code,
     subtotal, tax, delivery_fee, total, stripe_payment_intent_id, created_at, updated_at)
VALUES
    (1,  2,    NULL,                    'Demo Customer', '801-555-0101', 'DELIVERY', 'COMPLETED', '123 Main St',    'Salt Lake City', 'UT', '84101', 0,0,3.99,0, 'pi_demo_0001', DATE_SUB(NOW(), INTERVAL 28 DAY), DATE_SUB(NOW(), INTERVAL 28 DAY)),
    (2,  NULL, 'guest1@example.com',    'Alex Rivera',   '801-555-0102', 'CARRYOUT', 'COMPLETED', NULL,             NULL,             NULL, NULL,    0,0,0.00,0, 'pi_demo_0002', DATE_SUB(NOW(), INTERVAL 26 DAY), DATE_SUB(NOW(), INTERVAL 26 DAY)),
    (3,  2,    NULL,                    'Demo Customer', '801-555-0101', 'DELIVERY', 'COMPLETED', '123 Main St',    'Salt Lake City', 'UT', '84101', 0,0,3.99,0, 'pi_demo_0003', DATE_SUB(NOW(), INTERVAL 24 DAY), DATE_SUB(NOW(), INTERVAL 24 DAY)),
    (4,  NULL, 'guest2@example.com',    'Sam Chen',      '801-555-0103', 'DELIVERY', 'COMPLETED', '88 Oak Ave',     'Sandy',          'UT', '84070', 0,0,3.99,0, 'pi_demo_0004', DATE_SUB(NOW(), INTERVAL 21 DAY), DATE_SUB(NOW(), INTERVAL 21 DAY)),
    (5,  NULL, 'abandoned@example.com', 'Jordan Blake',  '801-555-0104', 'CARRYOUT', 'PENDING_PAYMENT', NULL,       NULL,             NULL, NULL,    0,0,0.00,0, NULL,           DATE_SUB(NOW(), INTERVAL 20 DAY), DATE_SUB(NOW(), INTERVAL 20 DAY)),
    (6,  2,    NULL,                    'Demo Customer', '801-555-0101', 'CARRYOUT', 'COMPLETED', NULL,             NULL,             NULL, NULL,    0,0,0.00,0, 'pi_demo_0006', DATE_SUB(NOW(), INTERVAL 18 DAY), DATE_SUB(NOW(), INTERVAL 18 DAY)),
    (7,  NULL, 'guest3@example.com',    'Priya Nair',    '801-555-0105', 'DELIVERY', 'COMPLETED', '9 Cedar Ln',     'Draper',         'UT', '84020', 0,0,3.99,0, 'pi_demo_0007', DATE_SUB(NOW(), INTERVAL 16 DAY), DATE_SUB(NOW(), INTERVAL 16 DAY)),
    (8,  2,    NULL,                    'Demo Customer', '801-555-0101', 'DELIVERY', 'COMPLETED', '123 Main St',    'Salt Lake City', 'UT', '84101', 0,0,3.99,0, 'pi_demo_0008', DATE_SUB(NOW(), INTERVAL 14 DAY), DATE_SUB(NOW(), INTERVAL 14 DAY)),
    (9,  NULL, 'guest4@example.com',    'Chris Vaughn',  '801-555-0106', 'DELIVERY', 'CANCELLED', '41 Pine Rd',     'Murray',         'UT', '84107', 0,0,3.99,0, 'pi_demo_0009', DATE_SUB(NOW(), INTERVAL 13 DAY), DATE_SUB(NOW(), INTERVAL 13 DAY)),
    (10, NULL, 'guest5@example.com',    'Dana Whitfield','801-555-0107', 'CARRYOUT', 'COMPLETED', NULL,             NULL,             NULL, NULL,    0,0,0.00,0, 'pi_demo_0010', DATE_SUB(NOW(), INTERVAL 11 DAY), DATE_SUB(NOW(), INTERVAL 11 DAY)),
    (11, 2,    NULL,                    'Demo Customer', '801-555-0101', 'DELIVERY', 'COMPLETED', '123 Main St',    'Salt Lake City', 'UT', '84101', 0,0,3.99,0, 'pi_demo_0011', DATE_SUB(NOW(), INTERVAL 9 DAY),  DATE_SUB(NOW(), INTERVAL 9 DAY)),
    (12, NULL, 'guest6@example.com',    'Morgan Ellis',  '801-555-0108', 'CARRYOUT', 'COMPLETED', NULL,             NULL,             NULL, NULL,    0,0,0.00,0, 'pi_demo_0012', DATE_SUB(NOW(), INTERVAL 7 DAY),  DATE_SUB(NOW(), INTERVAL 7 DAY)),
    (13, 2,    NULL,                    'Demo Customer', '801-555-0101', 'DELIVERY', 'COMPLETED', '123 Main St',    'Salt Lake City', 'UT', '84101', 0,0,3.99,0, 'pi_demo_0013', DATE_SUB(NOW(), INTERVAL 5 DAY),  DATE_SUB(NOW(), INTERVAL 5 DAY)),
    (14, NULL, 'guest7@example.com',    'Taylor Brooks', '801-555-0109', 'CARRYOUT', 'CANCELLED', NULL,             NULL,             NULL, NULL,    0,0,0.00,0, NULL,           DATE_SUB(NOW(), INTERVAL 4 DAY),  DATE_SUB(NOW(), INTERVAL 4 DAY)),
    (15, NULL, 'guest8@example.com',    'Riley Okafor',  '801-555-0110', 'DELIVERY', 'COMPLETED', '77 Birch Way',   'Midvale',        'UT', '84047', 0,0,3.99,0, 'pi_demo_0015', DATE_SUB(NOW(), INTERVAL 3 DAY),  DATE_SUB(NOW(), INTERVAL 3 DAY)),
    (16, 2,    NULL,                    'Demo Customer', '801-555-0101', 'CARRYOUT', 'COMPLETED', NULL,             NULL,             NULL, NULL,    0,0,0.00,0, 'pi_demo_0016', DATE_SUB(NOW(), INTERVAL 2 DAY),  DATE_SUB(NOW(), INTERVAL 2 DAY)),
    (17, NULL, 'guest9@example.com',    'Casey Lindgren','801-555-0111', 'DELIVERY', 'PREPARING', '12 Maple Dr',    'Taylorsville',   'UT', '84118', 0,0,3.99,0, 'pi_demo_0017', DATE_SUB(NOW(), INTERVAL 1 DAY),  DATE_SUB(NOW(), INTERVAL 1 DAY)),
    (18, 2,    NULL,                    'Demo Customer', '801-555-0101', 'DELIVERY', 'PAID',      '123 Main St',    'Salt Lake City', 'UT', '84101', 0,0,3.99,0, 'pi_demo_0018', DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_SUB(NOW(), INTERVAL 2 HOUR));
--rollback DELETE FROM customer_order;

--changeset pizza:201-seed-order-items
--comment unit_price is the snapshot of base size price + crust delta + toppings.
INSERT INTO order_item (id, order_id, product_id, product_name, size, crust_id, crust_name, quantity, unit_price, line_total) VALUES
    (1,  1,  1,  'Pepperoni Pizza',       'LARGE',  1, 'Original Pan',    1, 16.99, 16.99),
    (2,  1,  20, 'Pepsi',                 'LARGE',  NULL, NULL,           2,  2.99,  5.98),
    (3,  2,  3,  'Supreme Pizza',         'MEDIUM', 2, 'Hand Tossed',     1, 16.99, 16.99),
    (4,  3,  4,  'Meat Lovers Pizza',     'LARGE',  4, 'Stuffed Crust',   1, 23.49, 23.49),
    (5,  3,  25, 'Iced Tea',              'MEDIUM', NULL, NULL,           1,  2.49,  2.49),
    (6,  4,  2,  'Cheese Pizza',          'MEDIUM', 3, 'Thin ''N Crispy', 2, 12.99, 25.98),
    (7,  5,  1,  'Pepperoni Pizza',       'SMALL',  1, 'Original Pan',    1, 10.99, 10.99),
    (8,  6,  6,  'BBQ Chicken Pizza',     'LARGE',  2, 'Hand Tossed',     1, 19.99, 19.99),
    (9,  6,  22, 'Mountain Dew',          'LARGE',  NULL, NULL,           1,  2.99,  2.99),
    (10, 7,  5,  'Veggie Lovers Pizza',   'MEDIUM', 3, 'Thin ''N Crispy', 1, 17.99, 17.99),
    (11, 8,  1,  'Pepperoni Pizza',       'LARGE',  4, 'Stuffed Crust',   1, 21.24, 21.24),
    (12, 8,  24, 'Bottled Water',         'SMALL',  NULL, NULL,           2,  1.49,  2.98),
    (13, 9,  7,  'Hawaiian Pizza',        'MEDIUM', 2, 'Hand Tossed',     1, 15.49, 15.49),
    (14, 10, 8,  'Buffalo Chicken Pizza', 'LARGE',  2, 'Hand Tossed',     1, 19.99, 19.99),
    (15, 11, 3,  'Supreme Pizza',         'LARGE',  1, 'Original Pan',    1, 19.99, 19.99),
    (16, 11, 4,  'Meat Lovers Pizza',     'LARGE',  1, 'Original Pan',    1, 20.99, 20.99),
    (17, 11, 20, 'Pepsi',                 'LARGE',  NULL, NULL,           3,  2.99,  8.97),
    (18, 12, 2,  'Cheese Pizza',          'SMALL',  3, 'Thin ''N Crispy', 1,  9.99,  9.99),
    (19, 13, 1,  'Pepperoni Pizza',       'MEDIUM', 1, 'Original Pan',    1, 15.49, 15.49),
    (20, 13, 21, 'Diet Pepsi',            'MEDIUM', NULL, NULL,           1,  2.49,  2.49),
    (21, 14, 6,  'BBQ Chicken Pizza',     'MEDIUM', 2, 'Hand Tossed',     1, 16.99, 16.99),
    (22, 15, 4,  'Meat Lovers Pizza',     'MEDIUM', 4, 'Stuffed Crust',   1, 19.99, 19.99),
    (23, 15, 23, 'Starry',                'LARGE',  NULL, NULL,           2,  2.99,  5.98),
    (24, 16, 5,  'Veggie Lovers Pizza',   'LARGE',  3, 'Thin ''N Crispy', 1, 18.99, 18.99),
    (25, 17, 1,  'Pepperoni Pizza',       'LARGE',  1, 'Original Pan',    2, 16.99, 33.98),
    (26, 18, 3,  'Supreme Pizza',         'MEDIUM', 2, 'Hand Tossed',     1, 18.74, 18.74),
    (27, 18, 20, 'Pepsi',                 'MEDIUM', NULL, NULL,           1,  2.49,  2.49);
--rollback DELETE FROM order_item;

--changeset pizza:202-seed-order-item-toppings
--comment Only some items carry extra toppings, which is what real baskets look like.
INSERT INTO order_item_topping (order_item_id, topping_id, topping_name, price) VALUES
    (4,  11, 'Extra Cheese',    1.75),
    (10,  6, 'Mushrooms',       1.00),
    (10,  7, 'Green Peppers',   1.00),
    (11, 11, 'Extra Cheese',    1.75),
    (11,  3, 'Bacon',           1.75),
    (19,  6, 'Mushrooms',       1.00),
    (19,  8, 'Red Onions',      1.00),
    (26,  4, 'Grilled Chicken', 2.00),
    (26, 10, 'Jalapenos',       1.00);
--rollback DELETE FROM order_item_topping;

--changeset pizza:203-derive-order-totals
--comment Derive money from the line items so subtotal == SUM(line_total) always holds.
--comment Tax is a flat 8.5%, which is close enough to Utah for a demo.
UPDATE customer_order o
SET o.subtotal = COALESCE((SELECT SUM(i.line_total) FROM order_item i WHERE i.order_id = o.id), 0.00);

UPDATE customer_order o
SET o.tax = ROUND(o.subtotal * 0.085, 2);

UPDATE customer_order o
SET o.total = o.subtotal + o.tax + o.delivery_fee;
--rollback UPDATE customer_order SET subtotal = 0, tax = 0, total = 0;
