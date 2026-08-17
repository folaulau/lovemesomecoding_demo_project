package com.pizza.api.report;

import com.pizza.api.dto.ReportDTOs;

public interface ReportService {

    /** @param days how far back to look, counted from the start of that day */
    ReportDTOs.Dashboard getDashboard(int days);
}
