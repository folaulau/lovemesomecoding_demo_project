package com.pizza.api.messaging;

import com.pizza.api.entity.order.OrderPlacedEvent;
import java.math.BigDecimal;
import java.util.UUID;

/**
 * The order announcement as it travels over the queue.
 *
 * <p>A separate type from {@link OrderPlacedEvent} on purpose. The in-process event can change
 * whenever both sides are recompiled together; this one is a <b>wire contract</b> that some other
 * service — possibly not even a Java one — deserialises. Letting an internal refactor rename a
 * field on a published message is how you break a consumer you have never met.
 */
public record OrderMessage(UUID orderId, String customerEmail, BigDecimal total, String orderType) {

    public static OrderMessage from(OrderPlacedEvent event) {
        return new OrderMessage(
                event.orderPublicId(),
                event.contactEmail(),
                event.total(),
                event.orderType().name());
    }
}
