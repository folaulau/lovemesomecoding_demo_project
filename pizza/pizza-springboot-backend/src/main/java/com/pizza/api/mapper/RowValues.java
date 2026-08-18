package com.pizza.api.mapper;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Small shared helpers for the {@link org.springframework.jdbc.core.RowMapper}s in this package.
 *
 * <p>Exists so that the rounding rule for money is written down ONCE. Three different mappers read
 * money columns, and three slightly different opinions about rounding is how a dashboard ends up
 * disagreeing with itself.
 */
public final class RowValues {

    private RowValues() {}

    /**
     * Money always leaves the data-access layer at two decimal places.
     *
     * <p>MySQL's {@code AVG()} returns far more than that, and an un-rounded average is what puts
     * "$26.139999" on a dashboard. {@code null} becomes zero: a {@code SUM} over no rows is null,
     * and "no sales" is 0.00, not a {@code NullPointerException} three layers up.
     */
    public static BigDecimal money(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value.setScale(2, RoundingMode.HALF_UP);
    }
}
