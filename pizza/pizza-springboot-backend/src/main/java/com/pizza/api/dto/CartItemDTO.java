package com.pizza.api.dto;

import com.pizza.api.entity.product.SizeName;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** One saved cart line, with names and prices resolved from the current catalogue. */
public record CartItemDTO(
        UUID id,
        UUID productId,
        String productName,
        String productType,
        SizeName size,
        UUID crustId,
        String crustName,
        Integer quantity,
        List<CartItemToppingDTO> toppings,
        BigDecimal unitPrice,
        BigDecimal lineTotal) {

    public record CartItemToppingDTO(UUID toppingId, String toppingName, BigDecimal price) {}
}
