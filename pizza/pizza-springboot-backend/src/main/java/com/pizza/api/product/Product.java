package com.pizza.api.product;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A menu item — either a pizza or a drink.
 *
 * <p>Prices do not live here. They live on {@link ProductSize}, because every product is sold in
 * three sizes at three different prices.
 */
@Entity
@Table(name = "product")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, length = 120)
    private String name;

    @Column(name = "description", length = 500)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 20)
    private ProductType type;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    /** Soft delete. Products are never hard-deleted because old orders still reference them. */
    @Column(name = "active", nullable = false)
    private Boolean active;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    /**
     * Sizes are owned by the product: saving a product saves its sizes, and removing a size from
     * this list deletes the row (that is what orphanRemoval does). This is what lets the admin
     * screen edit a product and its three prices as one form submission.
     */
    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("price ASC")
    @Builder.Default
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
    void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (active == null) {
            active = Boolean.TRUE;
        }
        if (displayOrder == null) {
            displayOrder = 0;
        }
    }
}
