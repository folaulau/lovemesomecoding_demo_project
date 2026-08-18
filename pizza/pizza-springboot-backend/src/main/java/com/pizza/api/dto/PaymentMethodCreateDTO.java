package com.pizza.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/**
 * Saves a card that the BROWSER has already collected via Stripe Elements.
 *
 * <p>The only thing sent is Stripe's opaque handle. Card details never pass through this API — if
 * this record ever grows a `cardNumber` field, something has gone badly wrong.
 */
public record PaymentMethodCreateDTO(
        @Schema(description = "The pm_... id returned by Stripe Elements", example = "pm_1234") @NotBlank
                String stripePaymentMethodId,
        Boolean primary) {}
