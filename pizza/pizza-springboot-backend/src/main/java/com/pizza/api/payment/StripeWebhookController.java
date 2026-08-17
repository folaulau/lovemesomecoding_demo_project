package com.pizza.api.payment;

import com.pizza.api.entity.order.CustomerOrderService;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.PaymentIntent;
import com.stripe.net.Webhook;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Receives payment events from Stripe.
 *
 * <p>Run locally with:
 *
 * <pre>stripe listen --forward-to localhost:8085/api/webhooks/stripe</pre>
 *
 * and put the printed {@code whsec_...} into {@code pizza.stripe.webhook-secret}.
 */
@RestController
@RequestMapping("/api/webhooks")
@RequiredArgsConstructor
@Tag(name = "Webhooks", description = "Stripe callbacks (not called by the frontend)")
public class StripeWebhookController {

    private static final Logger log = LoggerFactory.getLogger(StripeWebhookController.class);

    private final CustomerOrderService orderService;

    @Value("${pizza.stripe.webhook-secret}")
    private String webhookSecret;

    /**
     * The raw body is required, not a parsed object: the signature is computed over the exact
     * bytes Stripe sent, so re-serialising a DTO would invalidate it.
     */
    @PostMapping("/stripe")
    @Operation(summary = "Stripe event receiver")
    public ResponseEntity<String> handle(
            @RequestBody String payload,
            @RequestHeader(value = "Stripe-Signature", required = false) String signature) {

        if (webhookSecret == null || webhookSecret.isBlank()) {
            log.warn("Received a webhook but pizza.stripe.webhook-secret is not set — ignoring");
            return ResponseEntity.ok("ignored");
        }

        Event event;
        try {
            // THIS is the security check. Without signature verification the endpoint is public
            // and anyone could POST a fake "payment succeeded" and get free pizza.
            event = Webhook.constructEvent(payload, signature, webhookSecret);
        } catch (SignatureVerificationException ex) {
            log.warn("Rejected a webhook with a bad signature");
            return ResponseEntity.badRequest().body("invalid signature");
        }

        if ("payment_intent.succeeded".equals(event.getType())) {
            event.getDataObjectDeserializer()
                    .getObject()
                    .filter(PaymentIntent.class::isInstance)
                    .map(PaymentIntent.class::cast)
                    .ifPresent(intent -> orderService.markPaid(intent.getId()));
        } else {
            log.debug("Ignoring Stripe event type {}", event.getType());
        }

        // Always 200 for events we understood. A non-2xx makes Stripe retry, which is only
        // desirable for genuine failures.
        return ResponseEntity.ok("ok");
    }
}
