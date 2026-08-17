package com.pizza.api;

import java.util.UUID;

/**
 * The UUIDs of the seeded demo rows.
 *
 * <p>Changeset {@code 301-backfill-public-ids} derives these deterministically from the numeric id
 * — {@code <prefix>-0000-4000-8000-<12-digit id>} — precisely so tests and frontend mocks have
 * stable identifiers to reference. Rows created at runtime get random UUIDs instead.
 *
 * <p>The per-table prefix is a readability aid for this demo only; real UUIDs carry no meaning.
 */
public final class TestIds {

    private TestIds() {}

    private static UUID of(String prefix, long id) {
        return UUID.fromString("%s-0000-4000-8000-%012d".formatted(prefix, id));
    }

    public static UUID product(long id) {
        return of("aaaaaaaa", id);
    }

    public static UUID crust(long id) {
        return of("cccccccc", id);
    }

    public static UUID topping(long id) {
        return of("bbbbbbbb", id);
    }

    public static UUID user(long id) {
        return of("dddddddd", id);
    }

    public static UUID order(long id) {
        return of("eeeeeeee", id);
    }

    // --- named shortcuts for the rows the tests actually use -------------------------------

    public static final UUID PEPPERONI_PIZZA = product(1);
    public static final UUID CHEESE_PIZZA = product(2);
    public static final UUID SUPREME_PIZZA = product(3);
    public static final UUID PEPSI = product(20);

    public static final UUID CRUST_STUFFED = crust(4);

    public static final UUID TOPPING_PEPPERONI = topping(1);
    public static final UUID TOPPING_BACON = topping(3);
    public static final UUID TOPPING_MUSHROOMS = topping(6);
    public static final UUID TOPPING_PARMESAN = topping(12);
    public static final UUID TOPPING_EXTRA_CHEESE = topping(11);

    /** A signed-in customer's completed delivery order. */
    public static final UUID ORDER_CUSTOMER_DELIVERY = order(1);

    /** A guest carryout order. */
    public static final UUID ORDER_GUEST_CARRYOUT = order(2);

    /** A three-line order, used to check subtotal == sum(line totals). */
    public static final UUID ORDER_MULTI_LINE = order(11);

    /** Nothing is seeded with this, so it must always 404. */
    public static final UUID NONEXISTENT = UUID.fromString("00000000-0000-4000-8000-000000000000");
}
