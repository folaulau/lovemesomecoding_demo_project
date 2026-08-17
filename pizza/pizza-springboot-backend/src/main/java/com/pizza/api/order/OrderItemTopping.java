package com.pizza.api.order;

import com.pizza.api.topping.Topping;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One topping on one order line, with the price it cost at the time.
 *
 * <p>This is a join table with an extra column, which is exactly why it is a real entity rather
 * than a {@code @ManyToMany}: the price has to be snapshotted per order.
 */
@Entity
@Table(name = "order_item_topping")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderItemTopping {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_item_id", nullable = false)
    private OrderItem orderItem;

    /** Null once the topping has been removed from the menu. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "topping_id")
    private Topping topping;

    @Column(name = "topping_name", nullable = false, length = 80)
    private String toppingName;

    @Column(name = "price", nullable = false, precision = 10, scale = 2)
    private BigDecimal price;
}
