package com.pizza.api.mapper;

import com.pizza.api.dto.ReportDTOs;
import java.sql.ResultSet;
import java.sql.SQLException;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Component;

/**
 * Maps an order-status tally onto {@link ReportDTOs.StatusCount}.
 *
 * <p>The status stays a {@code String} rather than being parsed into the enum: this feeds a chart,
 * and a status retired from the code but still present on historical rows should render as itself
 * instead of blowing up the whole report with an {@code IllegalArgumentException}.
 */
@Component
public class StatusCountRowMapper implements RowMapper<ReportDTOs.StatusCount> {

    @Override
    public ReportDTOs.StatusCount mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new ReportDTOs.StatusCount(rs.getString("status"), rs.getLong("status_count"));
    }
}
