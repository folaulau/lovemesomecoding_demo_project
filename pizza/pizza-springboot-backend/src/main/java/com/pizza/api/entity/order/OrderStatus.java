package com.pizza.api.entity.order;

/**
 * Order lifecycle.
 *
 * <p>An order is created as {@link #PENDING_PAYMENT} <em>before</em> the customer is charged, so
 * that Stripe has something to reference and so an abandoned checkout leaves a trace. It only
 * becomes {@link #PAID} when Stripe confirms it — never because the browser said so.
 */
public enum OrderStatus {
    PENDING_PAYMENT,
    PAID,
    PREPARING,
    COMPLETED,
    CANCELLED;

    /** Whether an order in this state counts toward revenue in the reports. */
    public boolean countsAsRevenue() {
        return this == PAID || this == PREPARING || this == COMPLETED;
    }
}
