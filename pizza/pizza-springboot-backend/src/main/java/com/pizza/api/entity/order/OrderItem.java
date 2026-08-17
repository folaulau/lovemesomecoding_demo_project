package com.pizza.api.entity.order;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.pizza.api.entity.DatabaseTableNames;
import com.pizza.api.entity.crust.Crust;
import com.pizza.api.entity.product.Product;
import com.pizza.api.entity.product.SizeName;
import jakarta.persistence.*;
import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/**
 * One line on an order: a product, at a size, on a crust, with toppings, times a quantity.
 *
 * <p>Note that {@code productName}, {@code crustName} and {@code unitPrice} are <b>snapshots</b>
 * taken when the order was placed. The foreign keys are kept for reporting, but the order must
 * still read correctly if the product is renamed, repriced, or deleted — which is also why
 * {@code product} is nullable.
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
        name = DatabaseTableNames.ORDER_ITEM,
        indexes = {
            @Index(name = "idx_order_item_order", columnList = "order_id"),
            @Index(name = "idx_order_item_product", columnList = "product_id")
        })
public class OrderItem implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false, unique = true)
    private Long id;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "public_id", nullable = false, updatable = false, unique = true, length = 36)
    private UUID publicId;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private CustomerOrder order;

    /** Null once the product has been deleted from the menu. The snapshot below survives. */
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    private Product product;

    @Column(name = "product_name", nullable = false, length = 120)
    private String productName;

    @Enumerated(EnumType.STRING)
    @Column(name = "size", nullable = false, length = 20)
    private SizeName size;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "crust_id")
    private Crust crust;

    @Column(name = "crust_name", length = 80)
    private String crustName;

    @Column(name = "quantity", nullable = false)
    private Integer quantity;

    /** Base size price + crust delta + toppings, for ONE unit. */
    @Column(name = "unit_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal unitPrice;

    /** {@code unitPrice * quantity}, stored so reporting never has to recompute it. */
    @Column(name = "line_total", nullable = false, precision = 10, scale = 2)
    private BigDecimal lineTotal;

    @Builder.Default
    @Column(name = "deleted", nullable = false)
    private boolean deleted = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /**
     * {@code @BatchSize} is what keeps loading these cheap. Without it, reading the toppings of an
     * order with 5 items costs 5 extra queries; with it, Hibernate loads up to 25 items' toppings
     * per query. This collection cannot be join-fetched alongside {@code CustomerOrder.items} —
     * see the note on {@code CustomerOrderRepository#findWithItemsByPublicId}.
     */
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @Builder.Default
    @OneToMany(mappedBy = "orderItem", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @BatchSize(size = 25)
    private List<OrderItemTopping> toppings = new ArrayList<>();

    public void addTopping(OrderItemTopping topping) {
        toppings.add(topping);
        topping.setOrderItem(this);
    }

    @PrePersist
    private void preCreate() {
        if (publicId == null) {
            publicId = UUID.randomUUID();
        }
    }
}
