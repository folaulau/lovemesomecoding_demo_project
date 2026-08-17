package com.pizza.api.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record CrustDTO(
        UUID id,
        String name,
        BigDecimal priceDelta,
        boolean active,
        Integer displayOrder,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {}
