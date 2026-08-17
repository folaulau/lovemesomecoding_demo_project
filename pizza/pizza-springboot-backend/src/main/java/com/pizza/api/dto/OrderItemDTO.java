package com.pizza.api.dto;

import com.pizza.api.entity.product.SizeName;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record OrderItemDTO(
        UUID id,
        UUID productId,
        String productName,
        SizeName size,
        UUID crustId,
        String crustName,
        Integer quantity,
        BigDecimal unitPrice,
        BigDecimal lineTotal,
        List<OrderItemToppingDTO> toppings) {}
