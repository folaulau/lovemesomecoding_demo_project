package com.pizza.api.dto;

import com.pizza.api.entity.product.ProductType;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * What the API returns for a product.
 *
 * <p>A DTO rather than the entity itself, for three reasons: the entity has lazy collections that
 * blow up when Jackson serialises them outside a transaction; the entity's shape is a database
 * concern that should be free to change without breaking clients; and exposing entities directly
 * makes it far too easy to leak a field nobody meant to publish.
 *
 * <p>{@code id} here is the entity's {@code publicId} UUID. The numeric primary key is never
 * published.
 */
@Schema(description = "A menu item")
public record ProductDTO(
        @Schema(description = "Public UUID — use this in every request") UUID id,
        String name,
        String description,
        ProductType type,
        String imageUrl,
        boolean active,
        Integer displayOrder,
        List<ProductSizeDTO> sizes,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {}
