package com.pizza.api.dto;

import com.pizza.api.entity.topping.ToppingCategory;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record ToppingDTO(
        UUID id,
        String name,
        BigDecimal price,
        ToppingCategory category,
        boolean active,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {}
