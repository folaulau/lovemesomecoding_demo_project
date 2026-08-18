package com.pizza.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** What the browser needs to collect a card without charging it. */
@Schema(description = "A Stripe SetupIntent for saving a card")
public record SetupIntentDTO(
        @Schema(description = "Pass to Stripe Elements to collect and store the card") String clientSecret) {}
