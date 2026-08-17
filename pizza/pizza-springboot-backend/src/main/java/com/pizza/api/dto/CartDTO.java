package com.pizza.api.dto;

import com.pizza.api.entity.order.OrderType;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * A saved cart, priced at read time.
 *
 * <p>The stored cart holds identifiers only; these figures are recomputed from the current
 * catalogue every time it is fetched, by the same code path that prices a real order.
 */
@Schema(description = "A saved cart, priced from the current menu")
public record CartDTO(
        @Schema(description = "Keep this UUID in the browser to find the cart again") UUID id,
        OrderType orderType,
        List<CartItemDTO> items,
        BigDecimal subtotal,
        BigDecimal tax,
        BigDecimal deliveryFee,
        BigDecimal total,
        int itemCount) {}
