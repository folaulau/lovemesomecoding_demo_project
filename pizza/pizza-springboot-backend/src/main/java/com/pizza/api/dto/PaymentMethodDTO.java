package com.pizza.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

/**
 * A saved card, as far as the UI is concerned.
 *
 * <p>Note what is absent: no card number, no CVC, and not even the Stripe token. The browser has
 * no use for the token — only our server can charge with it — so it is not published either.
 */
@Schema(description = "A saved card. Display metadata only.")
public record PaymentMethodDTO(
        UUID id,
        @Schema(example = "visa") String brand,
        @Schema(description = "Last four digits, for recognition only", example = "4242") String last4,
        Integer expMonth,
        Integer expYear,
        boolean primary) {}
