package com.pizza.api.dto;

import com.pizza.api.entity.order.OrderType;
import com.pizza.api.entity.product.SizeName;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

/**
 * What the browser sends to place an order.
 *
 * <p>Look at what is NOT here: no prices, no subtotal, no total. The client says only WHAT it
 * wants; the server decides what that costs. Accepting a price from the browser is how you end up
 * selling large pizzas for one cent.
 *
 * <p>All identifiers are UUIDs — the same ones the menu endpoints returned.
 */
@Schema(description = "A new order. Prices are deliberately not accepted from the client.")
public record OrderCreateDTO(
        @NotNull OrderType orderType,
        @NotBlank @Size(max = 150) String customerName,
        @Schema(description = "Required for guests; ignored when signed in") @Email @Size(max = 180) String guestEmail,
        @Size(max = 40) String phone,
        @Size(max = 200) String addressLine1,
        @Size(max = 200) String addressLine2,
        @Size(max = 100) String city,
        @Size(max = 50) String state,
        @Size(max = 20) String postalCode,
        @NotEmpty(message = "An order needs at least one item") @Valid List<ItemDTO> items) {

    @Schema(description = "One configured line. Identifiers only — no prices.")
    public record ItemDTO(
            @NotNull UUID productId,
            @NotNull SizeName size,
            @Schema(description = "Pizzas only; null for drinks") UUID crustId,
            List<UUID> toppingIds,
            @NotNull @Min(1) Integer quantity) {}
}
