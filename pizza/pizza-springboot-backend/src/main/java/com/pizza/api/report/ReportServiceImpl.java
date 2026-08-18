package com.pizza.api.report;

import com.pizza.api.dto.ReportDTOs;
import com.pizza.api.exception.ApiException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Builds the admin dashboard.
 *
 * <p>Deliberately thin. Since {@link ReportDAO} returns the response records directly, there is no
 * projection-to-DTO translation left to do here — the service validates the window, decides where it
 * starts, and assembles the four results into one payload. The rounding that used to live here moved
 * into the DAO's row mappers, so money is already at two decimal places by the time it arrives.
 */
@Service
@Slf4j
public class ReportServiceImpl implements ReportService {

    private static final int MAX_DAYS = 365;
    private static final int TOP_PRODUCT_LIMIT = 10;

    @Autowired
    private ReportDAO reportDAO;

    @Override
    @Transactional(readOnly = true)
    public ReportDTOs.Dashboard getDashboard(int days) {
        if (days < 1 || days > MAX_DAYS) {
            throw ApiException.badRequest("days must be between 1 and " + MAX_DAYS);
        }

        // From the START of the day N days ago, so "last 7 days" means 7 whole days rather than a
        // window that shifts with the current time.
        LocalDateTime from = LocalDate.now().minusDays(days - 1L).atStartOfDay();
        log.debug("Building the reports dashboard from {}", from);

        return new ReportDTOs.Dashboard(
                reportDAO.findSummary(from),
                reportDAO.findRevenueByDay(from),
                reportDAO.findTopProducts(from, TOP_PRODUCT_LIMIT),
                reportDAO.findStatusBreakdown(from));
    }
}
