package com.pizza.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

@Schema(description = "A saved delivery address")
public record AddressDTO(
        UUID id,
        String label,
        String recipientName,
        String phone,
        String line1,
        String line2,
        String city,
        String state,
        String postalCode,
        boolean primary) {

    /** One-line form for a chooser: "123 Main St, Salt Lake City, UT 84101". */
    public String summary() {
        return "%s, %s, %s %s".formatted(line1, city, state, postalCode);
    }
}
