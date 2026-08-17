package com.pizza.api.dto;

import com.pizza.api.entity.order.OrderType;
import com.pizza.api.entity.product.SizeName;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

/**
 * The whole cart, replaced in one PUT.
 *
 * <p>Replace-the-whole-thing rather than a set of add/remove/update endpoints. The browser already
 * holds the authoritative view while the customer is clicking, and one idempotent write is far
 * simpler to reason about than a stream of deltas that can arrive out of order.
 *
 * <p>No prices here either — the client says what it wants, the server decides what it costs.
 */
@Schema(description = "Replaces the cart's entire contents")
public record CartWriteDTO(@NotNull OrderType orderType, @Valid List<ItemDTO> items) {

    @Schema(description = "One configured line. Identifiers only.")
    public record ItemDTO(
            @NotNull UUID productId,
            @NotNull SizeName size,
            @Schema(description = "Pizzas only; null for drinks") UUID crustId,
            List<UUID> toppingIds,
            @NotNull @Min(1) Integer quantity) {}
}
