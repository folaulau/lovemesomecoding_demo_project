--liquibase formatted sql

-- Demo menu data. Kept in its own file so the schema and the sample data stay
-- separable — a real deployment would run 001 and skip 002/003.
-- IDs are explicit so the order seed in 003 can reference them reliably.

--changeset pizza:100-seed-crust
INSERT INTO crust (id, name, price_delta, active, display_order) VALUES
    (1, 'Original Pan',    0.00, TRUE, 1),
    (2, 'Hand Tossed',     0.00, TRUE, 2),
    (3, 'Thin ''N Crispy', 0.00, TRUE, 3),
    (4, 'Stuffed Crust',   2.50, TRUE, 4);
--rollback DELETE FROM crust;

--changeset pizza:101-seed-topping
INSERT INTO topping (id, name, price, category, active) VALUES
    (1,  'Pepperoni',        1.50, 'MEAT',   TRUE),
    (2,  'Italian Sausage',  1.50, 'MEAT',   TRUE),
    (3,  'Bacon',            1.75, 'MEAT',   TRUE),
    (4,  'Grilled Chicken',  2.00, 'MEAT',   TRUE),
    (5,  'Ham',              1.50, 'MEAT',   TRUE),
    (6,  'Mushrooms',        1.00, 'VEGGIE', TRUE),
    (7,  'Green Peppers',    1.00, 'VEGGIE', TRUE),
    (8,  'Red Onions',       1.00, 'VEGGIE', TRUE),
    (9,  'Black Olives',     1.00, 'VEGGIE', TRUE),
    (10, 'Jalapenos',        1.00, 'VEGGIE', TRUE),
    (11, 'Extra Cheese',     1.75, 'CHEESE', TRUE),
    (12, 'Parmesan',         1.25, 'CHEESE', TRUE);
--rollback DELETE FROM topping;

--changeset pizza:102-seed-pizza
INSERT INTO product (id, name, description, type, image_url, active, display_order, created_at) VALUES
    (1, 'Pepperoni Pizza',      'Classic pepperoni over mozzarella and our signature sauce',        'PIZZA', '/images/pizza-pepperoni.jpg',  TRUE, 1, '2026-01-01 00:00:00.000000'),
    (2, 'Cheese Pizza',         'Simple, generous mozzarella on a hand-stretched base',             'PIZZA', '/images/pizza-cheese.jpg',     TRUE, 2, '2026-01-01 00:00:00.000000'),
    (3, 'Supreme Pizza',        'Pepperoni, sausage, peppers, onions, mushrooms and olives',        'PIZZA', '/images/pizza-supreme.jpg',    TRUE, 3, '2026-01-01 00:00:00.000000'),
    (4, 'Meat Lovers Pizza',    'Pepperoni, sausage, bacon and ham. No vegetables were harmed',     'PIZZA', '/images/pizza-meat.jpg',       TRUE, 4, '2026-01-01 00:00:00.000000'),
    (5, 'Veggie Lovers Pizza',  'Mushrooms, peppers, onions, olives and tomatoes',                  'PIZZA', '/images/pizza-veggie.jpg',     TRUE, 5, '2026-01-01 00:00:00.000000'),
    (6, 'BBQ Chicken Pizza',    'Grilled chicken and red onion over smoky BBQ sauce',               'PIZZA', '/images/pizza-bbq.jpg',        TRUE, 6, '2026-01-01 00:00:00.000000'),
    (7, 'Hawaiian Pizza',       'Ham and pineapple. We are not getting into the debate',            'PIZZA', '/images/pizza-hawaiian.jpg',   TRUE, 7, '2026-01-01 00:00:00.000000'),
    (8, 'Buffalo Chicken Pizza','Grilled chicken tossed in buffalo sauce with a ranch drizzle',     'PIZZA', '/images/pizza-buffalo.jpg',    TRUE, 8, '2026-01-01 00:00:00.000000');
--rollback DELETE FROM product WHERE type = 'PIZZA';

--changeset pizza:103-seed-pizza-size
INSERT INTO product_size (product_id, size, price) VALUES
    (1, 'SMALL', 10.99), (1, 'MEDIUM', 13.99), (1, 'LARGE', 16.99),
    (2, 'SMALL',  9.99), (2, 'MEDIUM', 12.99), (2, 'LARGE', 15.49),
    (3, 'SMALL', 13.49), (3, 'MEDIUM', 16.99), (3, 'LARGE', 19.99),
    (4, 'SMALL', 13.99), (4, 'MEDIUM', 17.49), (4, 'LARGE', 20.99),
    (5, 'SMALL', 12.49), (5, 'MEDIUM', 15.99), (5, 'LARGE', 18.99),
    (6, 'SMALL', 13.49), (6, 'MEDIUM', 16.99), (6, 'LARGE', 19.99),
    (7, 'SMALL', 12.49), (7, 'MEDIUM', 15.49), (7, 'LARGE', 18.49),
    (8, 'SMALL', 13.49), (8, 'MEDIUM', 16.99), (8, 'LARGE', 19.99);
--rollback DELETE FROM product_size WHERE product_id BETWEEN 1 AND 8;

--changeset pizza:104-seed-drink
INSERT INTO product (id, name, description, type, image_url, active, display_order, created_at) VALUES
    (20, 'Pepsi',         'Chilled Pepsi',                    'DRINK', '/images/drink-pepsi.jpg',    TRUE, 1, '2026-01-01 00:00:00.000000'),
    (21, 'Diet Pepsi',    'Chilled Diet Pepsi',               'DRINK', '/images/drink-diet.jpg',     TRUE, 2, '2026-01-01 00:00:00.000000'),
    (22, 'Mountain Dew',  'Chilled Mountain Dew',             'DRINK', '/images/drink-dew.jpg',      TRUE, 3, '2026-01-01 00:00:00.000000'),
    (23, 'Starry',        'Lemon lime soda',                  'DRINK', '/images/drink-starry.jpg',   TRUE, 4, '2026-01-01 00:00:00.000000'),
    (24, 'Bottled Water', 'Still water',                      'DRINK', '/images/drink-water.jpg',    TRUE, 5, '2026-01-01 00:00:00.000000'),
    (25, 'Iced Tea',      'Freshly brewed, unsweetened',      'DRINK', '/images/drink-tea.jpg',      TRUE, 6, '2026-01-01 00:00:00.000000');
--rollback DELETE FROM product WHERE type = 'DRINK';

--changeset pizza:105-seed-drink-size
INSERT INTO product_size (product_id, size, price) VALUES
    (20, 'SMALL', 1.99), (20, 'MEDIUM', 2.49), (20, 'LARGE', 2.99),
    (21, 'SMALL', 1.99), (21, 'MEDIUM', 2.49), (21, 'LARGE', 2.99),
    (22, 'SMALL', 1.99), (22, 'MEDIUM', 2.49), (22, 'LARGE', 2.99),
    (23, 'SMALL', 1.99), (23, 'MEDIUM', 2.49), (23, 'LARGE', 2.99),
    (24, 'SMALL', 1.49), (24, 'MEDIUM', 1.99), (24, 'LARGE', 2.49),
    (25, 'SMALL', 1.99), (25, 'MEDIUM', 2.49), (25, 'LARGE', 2.99);
--rollback DELETE FROM product_size WHERE product_id BETWEEN 20 AND 25;

--changeset pizza:106-seed-users
--comment Demo credentials: admin@pizza.test / admin123  and  customer@pizza.test / pizza123
--comment These are BCrypt hashes of those passwords. Demo-only accounts.
INSERT INTO app_user (id, email, password_hash, full_name, role, created_at) VALUES
    (1, 'admin@pizza.test',    '$2y$10$VfdxXbiQL0xhxHVLqYXEU.gO4XoaZGyvmhSKWH7ZCAS1gfSyhjb.K', 'Demo Admin',    'ADMIN',    '2026-01-01 00:00:00.000000'),
    (2, 'customer@pizza.test', '$2y$10$LQQy6p.kohLcNUuHXALSVuwhYFJQW/jQc9Y7QObYzJFmQ40MTqIZm', 'Demo Customer', 'CUSTOMER', '2026-01-01 00:00:00.000000');
--rollback DELETE FROM app_user;
