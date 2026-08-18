package com.pizza.api.messaging;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.jms.annotation.JmsListener;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Component;

/**
 * Consumes the order queue.
 *
 * <p>In a real system this would live in the kitchen-display service, not here — a queue whose
 * producer and consumer are the same application is a queue that did not need to exist. It is in
 * this codebase so the round trip is demonstrable in one process.
 *
 * <p>⚠️ <b>A listener must be idempotent.</b> JMS guarantees at-least-once delivery, not
 * exactly-once: a broker restart or a slow acknowledgement can hand you the same message twice.
 * Anything with an external effect — charging a card, sending an email — has to be safe to repeat,
 * usually by recording the message id and ignoring one that has already been seen.
 */
@Slf4j
@Component
@Profile("messaging")
public class OrderMessageListener {

    /**
     * {@code containerFactory} names the bean from {@code MessagingConfig}. Omit it and Spring uses
     * its own default factory instead, silently dropping the transacted sessions and the
     * concurrency settings configured there.
     */
    @JmsListener(destination = MessagingConfig.ORDER_QUEUE, containerFactory = "jmsListenerContainerFactory")
    public void onOrderPlaced(@Payload OrderMessage message) {
        log.info(
                "Kitchen received order {} for {} ({} {})",
                message.orderId(),
                message.customerEmail(),
                message.total(),
                message.orderType());

        // Throwing here would roll the transacted session back and the broker would redeliver.
        // After the configured redelivery attempts, Artemis moves the message to
        // MessagingConfig.ORDER_DLQ rather than looping on it forever.
    }
}
