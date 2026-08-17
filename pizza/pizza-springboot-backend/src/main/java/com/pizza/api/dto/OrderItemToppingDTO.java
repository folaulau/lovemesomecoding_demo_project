package com.pizza.api.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record OrderItemToppingDTO(UUID id, UUID toppingId, String toppingName, BigDecimal price) {}
