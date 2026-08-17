package com.pizza.api.order;

import com.pizza.api.crust.Crust;
import com.pizza.api.product.Product;
import com.pizza.api.product.SizeName;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.BatchSize;

/**
 * One line on an order: a product, at a size, on a crust, with toppings, times a quantity.
 *
 * <p>Note that {@code productName}, {@code crustName} and {@code unitPrice} are <b>snapshots</b>
 * taken when the order was placed. The foreign keys are kept for reporting, but the order must
 * still read correctly if the product is renamed, repriced, or deleted — which is also why
 * {@code product} is nullable.
 */
@Entity
@Table(name = "order_item")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private CustomerOrder order;

    /** Null once the product has been deleted from the menu. The snapshot below survives. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    private Product product;

    @Column(name = "product_name", nullable = false, length = 120)
    private String productName;

    @Enumerated(EnumType.STRING)
    @Column(name = "size", nullable = false, length = 20)
    private SizeName size;

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

    /**
     * {@code @BatchSize} is what keeps loading these cheap. Without it, reading the toppings of an
     * order with 5 items costs 5 extra queries; with it, Hibernate loads up to 25 items' toppings
     * per query. This collection cannot be join-fetched alongside {@code CustomerOrder.items} —
     * see the note on {@code CustomerOrderRepository#findWithItemsById}.
     */
    @OneToMany(mappedBy = "orderItem", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @BatchSize(size = 25)
    @Builder.Default
    private List<OrderItemTopping> toppings = new ArrayList<>();

    public void addTopping(OrderItemTopping topping) {
        toppings.add(topping);
        topping.setOrderItem(this);
    }
}
