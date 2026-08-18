package com.pizza.api.report;

import static org.assertj.core.api.Assertions.assertThat;

import com.pizza.api.dto.ReportDTOs;
import com.pizza.api.entity.order.CustomerOrder;
import com.pizza.api.entity.order.CustomerOrderRepository;
import com.pizza.api.entity.order.OrderStatus;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * Guards the reporting aggregates.
 *
 * <p>{@code @Transactional} rolls every test back, so the soft-delete cases below can mutate the
 * seeded orders without leaving the demo database dirty.
 */
@SpringBootTest
@Transactional
@DisplayName("ReportService")
class ReportServiceImplTest {

    @Autowired
    private ReportService reportService;

    @Autowired
    private CustomerOrderRepository orderRepository;

    /** Revenue-bearing statuses, mirroring the status lists in {@link ReportDAOImp}. */
    private static final List<OrderStatus> EARNING =
            List.of(OrderStatus.PAID, OrderStatus.PREPARING, OrderStatus.COMPLETED);

    @Test
    @DisplayName("headline figures agree with each other")
    void summaryIsInternallyConsistent() {
        ReportDTOs.Summary summary = reportService.getDashboard(30).summary();

        assertThat(summary.totalOrders()).isPositive();
        assertThat(summary.totalRevenue()).isPositive();

        // average = revenue / orders, to the cent the SQL AVG() rounds to.
        BigDecimal recomputed = summary.totalRevenue()
                .divide(BigDecimal.valueOf(summary.totalOrders()), 2, java.math.RoundingMode.HALF_UP);
        assertThat(summary.averageOrderValue())
                .isCloseTo(recomputed, org.assertj.core.data.Offset.offset(new BigDecimal("0.01")));
    }

    @Test
    @DisplayName("revenue-by-day sums back to the headline revenue")
    void dailyRevenueSumsToTotal() {
        ReportDTOs.Dashboard dashboard = reportService.getDashboard(30);

        BigDecimal daily = dashboard.revenueByDay().stream()
                .map(ReportDTOs.RevenueByDay::revenue)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        long dailyOrders = dashboard.revenueByDay().stream()
                .mapToLong(ReportDTOs.RevenueByDay::orders)
                .sum();

        assertThat(daily).isEqualByComparingTo(dashboard.summary().totalRevenue());
        assertThat(dailyOrders).isEqualTo(dashboard.summary().totalOrders());
    }

    /**
     * The regression this class exists for.
     *
     * <p>The reporting queries are hand-written SQL, and SQL does not honour the
     * {@code @SQLRestriction("deleted = false")} on the entity — Hibernate only applies that when it
     * generates the query from the entity model. For a while every report here counted soft-deleted
     * orders as real revenue: the totals looked entirely plausible, which is exactly why nobody
     * noticed. If this test fails, a {@code deleted = 0} predicate has gone missing again.
     */
    @Test
    @DisplayName("a soft-deleted order stops counting toward revenue")
    void softDeletedOrdersAreExcluded() {
        ReportDTOs.Summary before = reportService.getDashboard(30).summary();

        CustomerOrder victim = orderRepository.findAll().stream()
                .filter(o -> EARNING.contains(o.getStatus()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("seed data has no earning order to delete"));
        BigDecimal itsTotal = victim.getTotal();

        victim.setDeleted(true);
        orderRepository.saveAndFlush(victim);

        ReportDTOs.Summary after = reportService.getDashboard(30).summary();

        assertThat(after.totalOrders()).isEqualTo(before.totalOrders() - 1);
        assertThat(after.totalRevenue())
                .isEqualByComparingTo(before.totalRevenue().subtract(itsTotal));
    }

    @Test
    @DisplayName("a soft-deleted order also drops out of the status breakdown")
    void softDeletedOrdersLeaveTheStatusBreakdown() {
        CustomerOrder victim = orderRepository.findAll().stream()
                .filter(o -> EARNING.contains(o.getStatus()))
                .findFirst()
                .orElseThrow();
        String status = victim.getStatus().name();

        long before = countFor(reportService.getDashboard(30).statusBreakdown(), status);

        victim.setDeleted(true);
        orderRepository.saveAndFlush(victim);

        assertThat(countFor(reportService.getDashboard(30).statusBreakdown(), status))
                .isEqualTo(before - 1);
    }

    @Test
    @DisplayName("top products never report more units than were actually sold")
    void topProductsStayWithinItemsSold() {
        ReportDTOs.Dashboard dashboard = reportService.getDashboard(30);

        long ranked = dashboard.topProducts().stream()
                .mapToLong(ReportDTOs.TopProduct::unitsSold)
                .sum();

        // The list is capped, so it is a subset — but never MORE than everything sold.
        assertThat(ranked).isLessThanOrEqualTo(dashboard.summary().itemsSold());
        assertThat(dashboard.topProducts()).allSatisfy(p -> {
            assertThat(p.productName()).isNotBlank();
            assertThat(p.unitsSold()).isPositive();
        });
    }

    private static long countFor(List<ReportDTOs.StatusCount> breakdown, String status) {
        return breakdown.stream()
                .filter(s -> s.status().equals(status))
                .mapToLong(ReportDTOs.StatusCount::count)
                .findFirst()
                .orElse(0L);
    }
}
