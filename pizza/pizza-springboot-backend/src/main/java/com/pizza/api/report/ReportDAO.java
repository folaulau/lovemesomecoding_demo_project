package com.pizza.api.report;

import com.pizza.api.dto.ReportDTOs;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Data-access contract for the admin reports.
 *
 * <p>Reporting is the one part of this application that is <b>not</b> about entities. Nothing here
 * loads a {@code CustomerOrder}; every method returns a handful of pre-aggregated rows that the
 * database computed. So this DAO is backed by {@code JdbcTemplate} rather than by a Spring Data
 * repository — see {@link ReportDAOImp} for why that is the better tool here.
 *
 * <p>Each method takes the window start and aggregates from there. The caller decides the window;
 * this layer only reads.
 */
public interface ReportDAO {

    /** Headline figures — order count, revenue, average order value and items sold. */
    ReportDTOs.Summary findSummary(LocalDateTime from);

    /** One row per calendar day that had at least one earning order. */
    List<ReportDTOs.RevenueByDay> findRevenueByDay(LocalDateTime from);

    /** Best sellers by units, largest first, capped at {@code limit} rows. */
    List<ReportDTOs.TopProduct> findTopProducts(LocalDateTime from, int limit);

    /** Order counts per status — including the statuses that earn nothing. */
    List<ReportDTOs.StatusCount> findStatusBreakdown(LocalDateTime from);
}
