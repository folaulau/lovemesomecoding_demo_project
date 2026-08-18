package com.pizza.api.entity.order;

import com.pizza.api.mail.MailService;
import com.pizza.api.messaging.OrderMessage;
import com.pizza.api.messaging.OrderMessagePublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * What happens after an order is placed — kept out of the code that places it.
 *
 * <p>Without events, {@code CustomerOrderServiceImpl.createOrder} would end with a growing list of
 * calls to the kitchen service, the email service, the analytics service and so on. Each one is a
 * new dependency injected into a class whose job is to create an order, and each one is a new way
 * for an unrelated failure to break checkout. Publishing one event inverts that: the order code
 * announces what happened and stops caring who listens.
 *
 * <h2>The two annotations, and why the difference matters</h2>
 *
 * <ul>
 *   <li>{@link EventListener} runs <b>immediately</b>, inside the publisher's transaction. Correct
 *       for work that must be rolled back with it.
 *   <li>{@link TransactionalEventListener} defers until the transaction reaches the phase you name.
 *       {@code AFTER_COMMIT} is what you want for anything with an effect outside the database.
 * </ul>
 *
 * <p>Get that wrong and the bug is nasty precisely because it is rare: a plain
 * {@code @EventListener} that sends a confirmation email fires while the transaction is still open,
 * so a rollback a millisecond later leaves the customer holding an email about an order that no
 * longer exists. It works in every test until the one time the transaction fails.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OrderPlacedListener {

    private final CustomerOrderService orderService;
    private final MailService mailService;
    private final OrderMessagePublisher messagePublisher;

    /**
     * Kitchen routing is part of placing the order: if the order rolls back, this must roll back
     * with it. So it is a plain listener, running synchronously inside the transaction.
     *
     * <p>{@code @Order} sets the sequence when several listeners take the same event — lower runs
     * first. Without it the ordering is unspecified, which is fine until one listener starts
     * depending on another having run.
     */
    @Order(10)
    @EventListener
    public void routeToKitchen(OrderPlacedEvent event) {
        log.info("Kitchen ticket queued for order {} ({})", event.orderPublicId(), event.orderType());
    }

    /**
     * Announces the order on the queue for whatever else cares about it.
     *
     * <p>AFTER_COMMIT for the same reason the email is: publishing inside the transaction would let
     * a consumer read the order from the database before the insert is visible, and act on an order
     * that a rollback is about to erase. Message brokers have no idea your transaction exists.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void publishToQueue(OrderPlacedEvent event) {
        messagePublisher.publish(OrderMessage.from(event));
    }

    /**
     * Email is the opposite case: it leaves the database, cannot be un-sent, and must not delay the
     * HTTP response.
     *
     * <p>{@code @Async} moves it onto the {@code taskExecutor} pool from {@code ThreadPoolConfig}.
     * Note that both annotations are needed and they do different jobs — {@code AFTER_COMMIT}
     * decides <b>when</b>, {@code @Async} decides <b>on which thread</b>.
     *
     * <p>The try/catch is deliberate. An exception escaping an {@code @Async} void method is
     * invisible to the caller; it goes to the {@code AsyncUncaughtExceptionHandler} and nowhere
     * near the customer, who has already been told the order succeeded — which it did. A failed
     * confirmation email is not a failed order, and this method has to behave that way.
     */
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void sendConfirmation(OrderPlacedEvent event) {
        try {
            // Re-read the order rather than carrying it on the event. The event deliberately holds
            // only values (see OrderPlacedEvent), and the confirmation needs the full line items —
            // so this is the point at which we go and get them, on a thread with its own
            // transaction and its own persistence context.
            mailService.sendOrderConfirmation(orderService.getOrderByPublicId(event.orderPublicId()));
        } catch (Exception ex) {
            log.error("Confirmation for order {} failed — the order itself is unaffected", event.orderPublicId(), ex);
        }
    }
}
