package com.pizza.api.payment;

import com.stripe.StripeClient;
import com.stripe.exception.StripeException;
import com.stripe.model.PaymentIntent;
import com.stripe.param.PaymentIntentCreateParams;
import jakarta.annotation.PostConstruct;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Thin wrapper over the Stripe API.
 *
 * <p>Only ever runs server-side: the secret key must never reach a browser. The browser gets the
 * publishable key plus a per-payment {@code clientSecret}, which is enough to confirm one card
 * payment and nothing else.
 */
@Service
public class StripeService {

    private static final Logger log = LoggerFactory.getLogger(StripeService.class);

    @Value("${pizza.stripe.secret-key}")
    private String secretKey;

    private StripeClient stripe;

    @PostConstruct
    void init() {
        if (secretKey == null || secretKey.isBlank()) {
            log.warn("pizza.stripe.secret-key is not set — checkout will fail. Put a test key in "
                    + "application-local.properties and run with -Dspring-boot.run.profiles=local");
            return;
        }
        if (secretKey.startsWith("sk_live_")) {
            // A demo app should never be able to move real money by accident.
            throw new IllegalStateException(
                    "A LIVE Stripe key is configured. This demo only accepts test keys (sk_test_...)");
        }
        this.stripe = new StripeClient(secretKey);
    }

    public boolean isConfigured() {
        return stripe != null;
    }

    /**
     * Creates a PaymentIntent for an order.
     *
     * @param amount the order total, in dollars
     * @param orderId our order's PUBLIC UUID, recorded as metadata so the webhook can trace it back
     * @return the PaymentIntent, whose id and clientSecret we need
     */
    public PaymentIntent createPaymentIntent(BigDecimal amount, UUID orderId, String receiptEmail)
            throws StripeException {
        requireConfigured();

        PaymentIntentCreateParams.Builder params = PaymentIntentCreateParams.builder()
                // Stripe works in the smallest currency unit — cents, as a long. Sending dollars
                // here would undercharge by a factor of 100.
                .setAmount(toCents(amount))
                .setCurrency("usd")
                .putAllMetadata(Map.of("orderId", String.valueOf(orderId)))
                .setAutomaticPaymentMethods(PaymentIntentCreateParams.AutomaticPaymentMethods.builder()
                        .setEnabled(true)
                        .build());

        if (receiptEmail != null && !receiptEmail.isBlank()) {
            params.setReceiptEmail(receiptEmail);
        }

        return stripe.paymentIntents().create(params.build());
    }

    public PaymentIntent retrieve(String paymentIntentId) throws StripeException {
        requireConfigured();
        return stripe.paymentIntents().retrieve(paymentIntentId);
    }

    /** 12.34 -> 1234. Scaling first avoids any floating-point surprise on the boundary. */
    static long toCents(BigDecimal amount) {
        return amount.setScale(2, RoundingMode.HALF_UP).movePointRight(2).longValueExact();
    }

    private void requireConfigured() {
        if (stripe == null) {
            throw new IllegalStateException("Stripe is not configured. Set pizza.stripe.secret-key (see "
                    + "application-local.properties.example)");
        }
    }
}
