package com.pizza.api.dto;

import com.pizza.api.entity.topping.ToppingCategory;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record ToppingCreateDTO(
        @NotBlank @Size(max = 80) String name,
        @NotNull @DecimalMin(value = "0.0", message = "Price cannot be negative") BigDecimal price,
        @NotNull ToppingCategory category,
        Boolean active) {}
