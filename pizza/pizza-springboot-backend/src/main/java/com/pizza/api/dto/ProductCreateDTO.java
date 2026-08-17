package com.pizza.api.dto;

import com.pizza.api.entity.product.ProductType;
import com.pizza.api.entity.product.SizeName;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

/**
 * Admin payload for creating or updating a product.
 *
 * <p>Separate from {@link ProductDTO} on purpose. The response carries an id; the request must not
 * let a client choose one. Reusing one class for both directions is how mass-assignment bugs get
 * in.
 *
 * <p>One DTO covers create and update because the shapes are identical here. Split it into
 * {@code ProductUpdateDTO} the moment they diverge — e.g. if update ever supports partial edits.
 */
public record ProductCreateDTO(
        @NotBlank @Size(max = 120) String name,
        @Size(max = 500) String description,
        @NotNull ProductType type,
        @Size(max = 500) String imageUrl,
        Boolean active,
        Integer displayOrder,
        @NotEmpty(message = "A product needs at least one size") @Valid List<SizeDTO> sizes) {

    public record SizeDTO(
            @NotNull SizeName size,
            @NotNull @DecimalMin(value = "0.0", inclusive = false, message = "Price must be positive")
                    BigDecimal price) {}
}
