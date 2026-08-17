package com.pizza.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * The reply to POST /api/orders.
 *
 * <p>{@code clientSecret} is what Stripe Elements needs in the browser to confirm the card. It is
 * scoped to this one PaymentIntent and is safe to send to the client — unlike the secret API key,
 * which never leaves the server.
 */
@Schema(description = "A created order awaiting payment")
public record OrderCreateResponseDTO(
        OrderDTO order, @Schema(description = "Pass to Stripe Elements to confirm payment") String clientSecret) {}
