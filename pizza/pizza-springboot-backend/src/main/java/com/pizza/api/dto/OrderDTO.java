package com.pizza.api.dto;

import com.pizza.api.entity.order.OrderStatus;
import com.pizza.api.entity.order.OrderType;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Schema(description = "A placed order")
public record OrderDTO(
        @Schema(description = "Public UUID — unguessable, unlike a sequential id") UUID id,
        OrderStatus status,
        OrderType orderType,
        String customerName,
        String email,
        String phone,
        String addressLine1,
        String addressLine2,
        String city,
        String state,
        String postalCode,
        BigDecimal subtotal,
        BigDecimal tax,
        BigDecimal deliveryFee,
        BigDecimal total,
        @Schema(description = "Card brand that paid, display only", example = "visa") String cardBrand,
        @Schema(description = "Last four digits. NOT the card number.", example = "4242") String cardLast4,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        List<OrderItemDTO> items) {}
