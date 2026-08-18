package com.pizza.api.report;

import com.pizza.api.dto.ReportDTOs;
import com.pizza.api.mapper.ReportSummaryRowMapper;
import com.pizza.api.mapper.RevenueByDayRowMapper;
import com.pizza.api.mapper.StatusCountRowMapper;
import com.pizza.api.mapper.TopProductRowMapper;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
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
 * had to build proxies for. Here the SQL is plain, the mapping is an explicit {@code RowMapper}, and
 * what you read is what the database runs.
 *
 * <p>The queries aggregate in the DATABASE and return a handful of rows. The alternative — loading
 * every order into memory and summing in Java — works fine on 18 demo rows and falls over on a real
 * order table. Aggregation belongs where the data is.
 *
 * <p>Each query is declared inside the method that runs it, so the SQL and the call that binds its
 * parameters are read together. The row mappings live in {@code com.pizza.api.mapper}, where they
 * can be tested on their own; the column ALIASES in the SQL below are the contract between the two.
 *
 * <p><b>Named parameters, never string concatenation.</b> {@code :from} and {@code :limit} are bound
 * by the driver, so nothing a caller passes can change the shape of the statement. The status lists
 * are literals in the SQL because they are fixed by the domain, not supplied by anyone.
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

    @Autowired
    private ReportSummaryRowMapper reportSummaryRowMapper;

    @Autowired
    private RevenueByDayRowMapper revenueByDayRowMapper;

    @Autowired
    private TopProductRowMapper topProductRowMapper;

    @Autowired
    private StatusCountRowMapper statusCountRowMapper;

    /** {@code PAID}, {@code PREPARING} and {@code COMPLETED} are the statuses where money was taken. */
    @Override
    public ReportDTOs.Summary findSummary(LocalDateTime from) {
        String query =
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

        // An aggregate without GROUP BY always returns exactly one row — COUNT/SUM over an empty set
        // is a row of zeroes, not zero rows — so this cannot throw EmptyResultDataAccessException.
        return jdbcTemplate.queryForObject(query, Map.of("from", from), reportSummaryRowMapper);
    }

    @Override
    public List<ReportDTOs.RevenueByDay> findRevenueByDay(LocalDateTime from) {
        String query =
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

        return jdbcTemplate.query(query, Map.of("from", from), revenueByDayRowMapper);
    }

    /**
     * Groups by the SNAPSHOTTED {@code product_name}, not by {@code product_id}. That is deliberate:
     * a product deleted from the menu still has to appear in historical sales, and its FK is null by
     * then.
     */
    @Override
    public List<ReportDTOs.TopProduct> findTopProducts(LocalDateTime from, int limit) {
        String query =
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

        // LIMIT is bound, not interpolated — MySQL accepts a placeholder there.
        return jdbcTemplate.query(query, Map.of("from", from, "limit", limit), topProductRowMapper);
    }

    /** Every status, including the ones that earn nothing — that is the point of this chart. */
    @Override
    public List<ReportDTOs.StatusCount> findStatusBreakdown(LocalDateTime from) {
        String query =
                """
                SELECT o.status AS status,
                       COUNT(*) AS status_count
                FROM customer_order o
                WHERE o.deleted = 0
                  AND o.created_at >= :from
                GROUP BY o.status
                ORDER BY status_count DESC
                """;

        return jdbcTemplate.query(query, Map.of("from", from), statusCountRowMapper);
    }
}
