package com.pizza.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Response shapes for the admin reports dashboard. */
public final class ReportDTOs {

    private ReportDTOs() {}

    @Schema(description = "Headline numbers for the selected window")
    public record Summary(long totalOrders, BigDecimal totalRevenue, BigDecimal averageOrderValue, long itemsSold) {}

    @Schema(description = "Revenue per calendar day")
    public record RevenueByDay(LocalDate day, long orders, BigDecimal revenue) {}

    @Schema(description = "Best sellers by units")
    public record TopProduct(String productName, long unitsSold, BigDecimal revenue) {}

    @Schema(description = "Order counts per status")
    public record StatusCount(String status, long count) {}

    @Schema(description = "Everything the dashboard needs, in one request")
    public record Dashboard(
            Summary summary,
            List<RevenueByDay> revenueByDay,
            List<TopProduct> topProducts,
            List<StatusCount> statusBreakdown) {}
}
