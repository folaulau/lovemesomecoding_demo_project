package com.pizza.api.report;

import com.pizza.api.dto.ReportDTOs;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Reporting queries, written as SQL and run through {@link NamedParameterJdbcTemplate}.
 *
 * <p><b>Why JdbcTemplate and not a Spring Data repository?</b> JPA's job is to map rows onto an
 * object graph and track changes to it. Reporting wants neither: there is no entity to load, no
 * identity map to populate, nothing to dirty-check. These aggregates used to be declared as
 * {@code @Query(nativeQuery = true)} on a repository interface, which meant real SQL travelling
 * through a persistence layer that added nothing to it, returning interface projections that Spring
 * had to build proxies for. Here the SQL is plain, the mapping is an explicit {@link RowMapper}, and
 * what you read is what the database runs.
 *
 * <p>The queries aggregate in the DATABASE and return a handful of rows. The alternative — loading
 * every order into memory and summing in Java — works fine on 18 demo rows and falls over on a real
 * order table. Aggregation belongs where the data is.
 *
 * <p><b>Named parameters, never string concatenation.</b> {@code :from} and {@code :limit} are bound
 * by the driver, so nothing a caller passes can change the shape of the statement. The status lists
 * below are literals in the SQL because they are fixed by the domain, not supplied by anyone.
 *
 * <p><b>Every query filters {@code deleted = 0}, and that is not optional.</b> The entities carry
 * {@code @SQLRestriction("deleted = false")}, so soft-deleted rows vanish from ordinary JPA reads
 * and it is tempting to assume they are gone everywhere. They are not: that annotation is applied by
 * Hibernate when it builds a query from the entity model, and SQL written here never goes near the
 * entity model. Omitting the predicate silently counts cancelled-and-deleted orders as revenue — the
 * reports stay entirely plausible, just wrong, which is why it went unnoticed for a while. Guarded
 * by {@code ReportServiceImplTest#softDeletedOrdersAreExcluded}.
 */
@Slf4j
@Repository
public class ReportDAOImp implements ReportDAO {

    @Autowired
    private NamedParameterJdbcTemplate jdbcTemplate;

    // ------------------------------------------------------------------ summary

    /** {@code PAID}, {@code PREPARING} and {@code COMPLETED} are the statuses where money was taken. */
    private static final String SUMMARY_SQL =
            """
            SELECT COUNT(*)                  AS total_orders,
                   COALESCE(SUM(o.total), 0) AS total_revenue,
                   COALESCE(AVG(o.total), 0) AS average_order_value,
                   COALESCE((SELECT SUM(i.quantity)
                             FROM order_item i
                             JOIN customer_order co ON co.id = i.order_id
                             WHERE co.status IN ('PAID','PREPARING','COMPLETED')
                               AND co.deleted = 0
                               AND i.deleted = 0
                               AND co.created_at >= :from), 0) AS items_sold
            FROM customer_order o
            WHERE o.status IN ('PAID','PREPARING','COMPLETED')
              AND o.deleted = 0
              AND o.created_at >= :from
            """;

    @Override
    public ReportDTOs.Summary findSummary(LocalDateTime from) {
        // An aggregate without GROUP BY always returns exactly one row — COUNT/SUM over an empty set
        // is a row of zeroes, not zero rows — so this cannot throw EmptyResultDataAccessException.
        return jdbcTemplate.queryForObject(
                SUMMARY_SQL,
                Map.of("from", from),
                (rs, rowNum) -> new ReportDTOs.Summary(
                        rs.getLong("total_orders"),
                        money(rs.getBigDecimal("total_revenue")),
                        money(rs.getBigDecimal("average_order_value")),
                        rs.getLong("items_sold")));
    }

    // ------------------------------------------------------------ revenue by day

    private static final String REVENUE_BY_DAY_SQL =
            """
            SELECT DATE(o.created_at) AS day,
                   COUNT(*)           AS orders,
                   SUM(o.total)       AS revenue
            FROM customer_order o
            WHERE o.status IN ('PAID','PREPARING','COMPLETED')
              AND o.deleted = 0
              AND o.created_at >= :from
            GROUP BY DATE(o.created_at)
            ORDER BY day
            """;

    /**
     * {@code getObject(col, LocalDate.class)} rather than {@code getDate}: the latter hands back a
     * {@code java.sql.Date}, dragging the JVM default timezone into a value that has no time in it.
     * That is the same class of bug that once shifted every timestamp in this app by seven hours.
     */
    private static final RowMapper<ReportDTOs.RevenueByDay> REVENUE_BY_DAY_MAPPER =
            (rs, rowNum) -> new ReportDTOs.RevenueByDay(
                    rs.getObject("day", LocalDate.class), rs.getLong("orders"), money(rs.getBigDecimal("revenue")));

    @Override
    public List<ReportDTOs.RevenueByDay> findRevenueByDay(LocalDateTime from) {
        return jdbcTemplate.query(REVENUE_BY_DAY_SQL, Map.of("from", from), REVENUE_BY_DAY_MAPPER);
    }

    // ------------------------------------------------------------- top products

    /**
     * Groups by the SNAPSHOTTED {@code product_name}, not by {@code product_id}. That is deliberate:
     * a product deleted from the menu still has to appear in historical sales, and its FK is null by
     * then.
     */
    private static final String TOP_PRODUCTS_SQL =
            """
            SELECT i.product_name    AS product_name,
                   SUM(i.quantity)   AS units_sold,
                   SUM(i.line_total) AS revenue
            FROM order_item i
            JOIN customer_order o ON o.id = i.order_id
            WHERE o.status IN ('PAID','PREPARING','COMPLETED')
              AND o.deleted = 0
              AND i.deleted = 0
              AND o.created_at >= :from
            GROUP BY i.product_name
            ORDER BY units_sold DESC
            LIMIT :limit
            """;

    private static final RowMapper<ReportDTOs.TopProduct> TOP_PRODUCT_MAPPER =
            (rs, rowNum) -> new ReportDTOs.TopProduct(
                    rs.getString("product_name"), rs.getLong("units_sold"), money(rs.getBigDecimal("revenue")));

    @Override
    public List<ReportDTOs.TopProduct> findTopProducts(LocalDateTime from, int limit) {
        // LIMIT is bound, not interpolated — MySQL accepts a placeholder there.
        return jdbcTemplate.query(TOP_PRODUCTS_SQL, Map.of("from", from, "limit", limit), TOP_PRODUCT_MAPPER);
    }

    // --------------------------------------------------------- status breakdown

    /** Every status, including the ones that earn nothing — that is the point of this chart. */
    private static final String STATUS_BREAKDOWN_SQL =
            """
            SELECT o.status AS status,
                   COUNT(*) AS status_count
            FROM customer_order o
            WHERE o.deleted = 0
              AND o.created_at >= :from
            GROUP BY o.status
            ORDER BY status_count DESC
            """;

    private static final RowMapper<ReportDTOs.StatusCount> STATUS_COUNT_MAPPER =
            (rs, rowNum) -> new ReportDTOs.StatusCount(rs.getString("status"), rs.getLong("status_count"));

    @Override
    public List<ReportDTOs.StatusCount> findStatusBreakdown(LocalDateTime from) {
        return jdbcTemplate.query(STATUS_BREAKDOWN_SQL, Map.of("from", from), STATUS_COUNT_MAPPER);
    }

    // ------------------------------------------------------------------ helpers

    /**
     * Money always leaves this layer at two decimal places. MySQL's {@code AVG()} returns far more
     * than that, and an un-rounded average is what puts "$26.139999" on a dashboard.
     */
    private static BigDecimal money(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value.setScale(2, RoundingMode.HALF_UP);
    }
}
