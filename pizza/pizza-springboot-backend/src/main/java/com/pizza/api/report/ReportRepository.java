package com.pizza.api.report;

import com.pizza.api.entity.order.CustomerOrder;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/**
 * Reporting queries.
 *
 * <p>These are native SQL and aggregate in the DATABASE, returning a handful of rows. The
 * alternative — loading every order into memory and summing in Java — works fine on 18 demo rows
 * and falls over completely on a real order table. Aggregation belongs where the data is.
 *
 * <p>Extends the bare {@code Repository} marker rather than {@code JpaRepository}: this type
 * should expose reporting reads only, not save/delete.
 */
public interface ReportRepository extends Repository<CustomerOrder, Long> {

    /** Only these statuses represent money actually taken. */
    String REVENUE_STATUSES = "('PAID','PREPARING','COMPLETED')";

    @Query(
            value =
                    """
                    SELECT COUNT(*)                                   AS totalOrders,
                           COALESCE(SUM(o.total), 0)                  AS totalRevenue,
                           COALESCE(AVG(o.total), 0)                  AS averageOrderValue,
                           COALESCE((SELECT SUM(i.quantity)
                                     FROM order_item i
                                     JOIN customer_order co ON co.id = i.order_id
                                     WHERE co.status IN ('PAID','PREPARING','COMPLETED')
                                       AND co.created_at >= :from), 0) AS itemsSold
                    FROM customer_order o
                    WHERE o.status IN ('PAID','PREPARING','COMPLETED')
                      AND o.created_at >= :from
                    """,
            nativeQuery = true)
    ReportProjections.SummaryRow findSummary(@Param("from") LocalDateTime from);

    @Query(
            value =
                    """
                    SELECT DATE(o.created_at)     AS day,
                           COUNT(*)               AS orders,
                           SUM(o.total)           AS revenue
                    FROM customer_order o
                    WHERE o.status IN ('PAID','PREPARING','COMPLETED')
                      AND o.created_at >= :from
                    GROUP BY DATE(o.created_at)
                    ORDER BY day
                    """,
            nativeQuery = true)
    List<ReportProjections.RevenueByDayRow> findRevenueByDay(@Param("from") LocalDateTime from);

    /**
     * Groups by the SNAPSHOTTED product_name, not by product_id. That is deliberate: a product
     * deleted from the menu still has to appear in historical sales, and its FK is null by then.
     */
    @Query(
            value =
                    """
                    SELECT i.product_name        AS productName,
                           SUM(i.quantity)       AS unitsSold,
                           SUM(i.line_total)     AS revenue
                    FROM order_item i
                    JOIN customer_order o ON o.id = i.order_id
                    WHERE o.status IN ('PAID','PREPARING','COMPLETED')
                      AND o.created_at >= :from
                    GROUP BY i.product_name
                    ORDER BY unitsSold DESC
                    LIMIT :limit
                    """,
            nativeQuery = true)
    List<ReportProjections.TopProductRow> findTopProducts(@Param("from") LocalDateTime from, @Param("limit") int limit);

    /** Every status, including the ones that earn nothing — that is the point of this chart. */
    @Query(
            value =
                    """
                    SELECT o.status AS status, COUNT(*) AS count
                    FROM customer_order o
                    WHERE o.created_at >= :from
                    GROUP BY o.status
                    ORDER BY count DESC
                    """,
            nativeQuery = true)
    List<ReportProjections.StatusCountRow> findStatusBreakdown(@Param("from") LocalDateTime from);
}
