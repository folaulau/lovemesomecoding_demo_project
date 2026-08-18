package com.pizza.api.messaging;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jms.core.JmsTemplate;
import org.springframework.stereotype.Component;

/**
 * Puts an order announcement on the queue.
 *
 * <p>Uses {@link ObjectProvider} for the same reason {@code MailServiceImpl} does: without the
 * {@code messaging} profile there is no {@code JmsTemplate} bean, and a required dependency would
 * stop the whole application from starting on a machine with no broker.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OrderMessagePublisher {

    private final ObjectProvider<JmsTemplate> jmsTemplateProvider;

    public void publish(OrderMessage message) {
        JmsTemplate jms = jmsTemplateProvider.getIfAvailable();
        if (jms == null) {
            log.debug("Messaging is off — not publishing order {}", message.orderId());
            return;
        }

        try {
            // convertAndSend runs the payload through the MessageConverter from MessagingConfig,
            // so what actually goes on the wire is JSON plus a _type property.
            jms.convertAndSend(MessagingConfig.ORDER_QUEUE, message);
            log.info("Published order {} to {}", message.orderId(), MessagingConfig.ORDER_QUEUE);
        } catch (Exception ex) {
            // The order is already committed and paid for. A broker outage must not turn that into
            // a customer-visible failure, so this is logged and swallowed — the same call the
            // confirmation email makes.
            log.error("Could not publish order {} — the order is unaffected", message.orderId(), ex);
        }
    }
}
