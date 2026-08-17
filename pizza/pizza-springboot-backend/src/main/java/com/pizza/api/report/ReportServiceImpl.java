package com.pizza.api.report;

import com.pizza.api.dto.ReportDTOs;
import com.pizza.api.exception.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Slf4j
public class ReportServiceImpl implements ReportService {

    private static final int MAX_DAYS = 365;
    private static final int TOP_PRODUCT_LIMIT = 10;

    @Autowired
    private ReportRepository reportRepository;

    @Override
    @Transactional(readOnly = true)
    public ReportDTOs.Dashboard getDashboard(int days) {
        if (days < 1 || days > MAX_DAYS) {
            throw ApiException.badRequest("days must be between 1 and " + MAX_DAYS);
        }

        // From the START of the day N days ago, so "last 7 days" means 7 whole days rather than
        // a window that shifts with the current time.
        LocalDateTime from = LocalDate.now().minusDays(days - 1L).atStartOfDay();
        log.debug("Building the reports dashboard from {}", from);

        return new ReportDTOs.Dashboard(
                toSummary(reportRepository.findSummary(from)),
                toRevenueByDay(reportRepository.findRevenueByDay(from)),
                toTopProducts(reportRepository.findTopProducts(from, TOP_PRODUCT_LIMIT)),
                toStatusCounts(reportRepository.findStatusBreakdown(from)));
    }

    private ReportDTOs.Summary toSummary(ReportProjections.SummaryRow row) {
        if (row == null) {
            return new ReportDTOs.Summary(0, BigDecimal.ZERO, BigDecimal.ZERO, 0);
        }
        return new ReportDTOs.Summary(
                row.getTotalOrders(),
                scale(row.getTotalRevenue()),
                scale(row.getAverageOrderValue()),
                row.getItemsSold() == null ? 0 : row.getItemsSold());
    }

    private List<ReportDTOs.RevenueByDay> toRevenueByDay(List<ReportProjections.RevenueByDayRow> rows) {
        return rows.stream()
                .map(row -> new ReportDTOs.RevenueByDay(row.getDay(), row.getOrders(), scale(row.getRevenue())))
                .toList();
    }

    private List<ReportDTOs.TopProduct> toTopProducts(List<ReportProjections.TopProductRow> rows) {
        return rows.stream()
                .map(row ->
                        new ReportDTOs.TopProduct(row.getProductName(), row.getUnitsSold(), scale(row.getRevenue())))
                .toList();
    }

    private List<ReportDTOs.StatusCount> toStatusCounts(List<ReportProjections.StatusCountRow> rows) {
        return rows.stream()
                .map(row -> new ReportDTOs.StatusCount(row.getStatus(), row.getCount()))
                .toList();
    }

    private BigDecimal scale(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value.setScale(2, RoundingMode.HALF_UP);
    }
}
