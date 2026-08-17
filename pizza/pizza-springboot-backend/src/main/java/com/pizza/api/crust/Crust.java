package com.pizza.api.crust;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A crust choice. Most crusts cost nothing extra; stuffed crust adds a surcharge, which is what
 * {@code priceDelta} is for.
 */
@Entity
@Table(name = "crust")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Crust {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, length = 80)
    private String name;

    /** Added on top of the size price, not a multiplier. */
    @Column(name = "price_delta", nullable = false, precision = 10, scale = 2)
    private BigDecimal priceDelta;

    @Column(name = "active", nullable = false)
    private Boolean active;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    @PrePersist
    void onCreate() {
        if (active == null) {
            active = Boolean.TRUE;
        }
        if (priceDelta == null) {
            priceDelta = BigDecimal.ZERO;
        }
        if (displayOrder == null) {
            displayOrder = 0;
        }
    }
}
