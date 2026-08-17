package com.pizza.api.entity.product;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.pizza.api.entity.DatabaseTableNames;
import jakarta.persistence.*;
import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/**
 * A menu item — either a pizza or a drink.
 *
 * <p>Prices do not live here. They live on {@link ProductSize}, because every product is sold in
 * three sizes at three different prices.
 *
 * <p><b>Two identifiers, on purpose.</b> {@code id} is the BIGINT primary key and the target of
 * every foreign key — compact, sequential, and never leaves the server. {@code publicId} is the
 * UUID the API exposes; sequential ids would let anyone walk /api/products/1, /2, /3.
 */
@Builder
@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonInclude(value = Include.NON_NULL)
@DynamicUpdate
@Entity
@SQLRestriction("deleted = false")
@Table(
        name = DatabaseTableNames.PRODUCT,
        indexes = {
            @Index(name = "idx_product_type_active", columnList = "type, active"),
            @Index(name = "idx_product_deleted", columnList = "deleted")
        })
public class Product implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false, unique = true)
    private Long id;

    /**
     * {@code @JdbcTypeCode(SqlTypes.CHAR)} is load-bearing: without it Hibernate stores a
     * {@code java.util.UUID} as BINARY(16), which would not match the CHAR(36) column and
     * {@code ddl-auto=validate} would refuse to start.
     */
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "public_id", nullable = false, updatable = false, unique = true, length = 36)
    private UUID publicId;

    @Column(name = "name", nullable = false, length = 120)
    private String name;

    @Column(name = "description", length = 500)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 20)
    private ProductType type;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    /** Temporarily off the menu. Still visible and editable in the admin screen. */
    @Builder.Default
    @Column(name = "active", nullable = false)
    private boolean active = true;

    /** Gone for good. @SQLRestriction filters these out of every query automatically. */
    @Builder.Default
    @Column(name = "deleted", nullable = false)
    private boolean deleted = false;

    @Builder.Default
    @Column(name = "display_order", nullable = false)
    private Integer displayOrder = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /**
     * Sizes are owned by the product: saving a product saves its sizes, and removing a size from
     * this list deletes the row (that is what orphanRemoval does).
     *
     * <p>Excluded from equals/hashCode/toString. {@code @Data} would otherwise walk the collection
     * — forcing a lazy load on every toString, and recursing forever through the child's parent
     * reference. This is the single most common way @Data and JPA go wrong together.
     */
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @Builder.Default
    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("price ASC")
    private List<ProductSize> sizes = new ArrayList<>();

    /** Keeps both sides of the relationship in sync — forgetting this is a classic JPA bug. */
    public void addSize(ProductSize size) {
        sizes.add(size);
        size.setProduct(this);
    }

    public void removeSize(ProductSize size) {
        sizes.remove(size);
        size.setProduct(null);
    }

    /** Convenience for pricing: the price for one size, if this product is sold in it. */
    public Optional<BigDecimal> priceFor(SizeName size) {
        return sizes.stream()
                .filter(s -> s.getSize() == size)
                .map(ProductSize::getPrice)
                .findFirst();
    }

    @PrePersist
    private void preCreate() {
        if (publicId == null) {
            publicId = UUID.randomUUID();
        }
    }
}
