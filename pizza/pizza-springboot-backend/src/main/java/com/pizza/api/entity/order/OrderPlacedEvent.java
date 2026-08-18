package com.pizza.api.entity.order;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Published once an order has been persisted.
 *
 * <p>Since Spring 4.2 an event can be any object — there is no {@code extends ApplicationEvent}
 * requirement any more, so a record is the natural shape.
 *
 * <p><b>Carry values, not entities.</b> This record holds the id and the totals rather than the
 * {@link CustomerOrder} itself. An async listener runs on a different thread, after the
 * transaction and its persistence context have closed, so touching a lazy association on a
 * detached entity there throws {@code LazyInitializationException}. Copying the few fields a
 * listener actually needs sidesteps the whole problem.
 */
public record OrderPlacedEvent(UUID orderPublicId, String contactEmail, BigDecimal total, OrderType orderType) {

    static OrderPlacedEvent from(CustomerOrder order) {
        return new OrderPlacedEvent(order.getPublicId(), order.contactEmail(), order.getTotal(), order.getOrderType());
    }
}
