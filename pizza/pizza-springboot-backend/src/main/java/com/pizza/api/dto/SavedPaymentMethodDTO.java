package com.pizza.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/**
 * Which saved card should pay for an order.
 *
 * <p>The id is OURS — the one {@code GET /api/me/payment-methods} returned. The browser never
 * holds the Stripe {@code pm_...} token, so it cannot send one; the server looks it up after
 * checking the card belongs to the caller.
 */
@Schema(description = "A saved card to pay an order with. Our id, never a Stripe token.")
public record SavedPaymentMethodDTO(
        @Schema(description = "The saved card's id from GET /api/me/payment-methods") @NotNull UUID paymentMethodId) {}
