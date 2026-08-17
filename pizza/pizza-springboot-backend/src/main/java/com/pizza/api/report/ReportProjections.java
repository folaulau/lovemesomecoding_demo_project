package com.pizza.api.report;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Interface-based projections. Spring Data builds a proxy that reads each column by matching the
 * getter name to the query's column alias — so an aggregate query does not need an entity to map
 * onto, and no DTO constructor has to line up positionally.
 */
public final class ReportProjections {

    private ReportProjections() {}

    public interface RevenueByDayRow {
        /**
         * The MySQL driver hands a DATE column back as a {@link LocalDate}. Declaring
         * {@code java.sql.Date} here compiles fine and then fails at runtime with
         * "Cannot project java.time.LocalDate to java.sql.Date" — projections do no type coercion
         * beyond registered converters, so the getter must match what the driver actually returns.
         */
        LocalDate getDay();

        long getOrders();

        BigDecimal getRevenue();
    }

    public interface TopProductRow {
        String getProductName();

        long getUnitsSold();

        BigDecimal getRevenue();
    }

    public interface StatusCountRow {
        String getStatus();

        long getCount();
    }

    public interface SummaryRow {
        long getTotalOrders();

        BigDecimal getTotalRevenue();

        BigDecimal getAverageOrderValue();

        Long getItemsSold();
    }
}
