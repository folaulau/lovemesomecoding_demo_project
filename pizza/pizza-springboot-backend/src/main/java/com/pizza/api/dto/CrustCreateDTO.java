package com.pizza.api.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record CrustCreateDTO(
        @NotBlank @Size(max = 80) String name,
        @NotNull @DecimalMin(value = "0.0", message = "Surcharge cannot be negative") BigDecimal priceDelta,
        Boolean active,
        Integer displayOrder) {}
