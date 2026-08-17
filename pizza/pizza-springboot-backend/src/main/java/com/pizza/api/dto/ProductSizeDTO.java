package com.pizza.api.dto;

import com.pizza.api.entity.product.SizeName;
import java.math.BigDecimal;
import java.util.UUID;

public record ProductSizeDTO(UUID id, SizeName size, BigDecimal price) {}
