package com.pizza.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Create or update a saved address. The owner is taken from the token, never from the body. */
public record AddressCreateDTO(
        @Size(max = 60) String label,
        @Size(max = 150) String recipientName,
        @Size(max = 40) String phone,
        @NotBlank @Size(max = 200) String line1,
        @Size(max = 200) String line2,
        @NotBlank @Size(max = 100) String city,
        @NotBlank @Size(max = 50) String state,
        @NotBlank @Pattern(regexp = "\\d{5}", message = "Five digits, please") String postalCode,
        Boolean primary) {}
