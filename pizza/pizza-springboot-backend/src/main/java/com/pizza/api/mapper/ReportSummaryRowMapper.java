package com.pizza.api.mapper;

import com.pizza.api.dto.ReportDTOs;
import java.sql.ResultSet;
import java.sql.SQLException;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Component;

/**
 * Maps the reports summary row onto {@link ReportDTOs.Summary}.
 *
 * <p>A {@code RowMapper} is called once per row and must not hold per-query state, which is why
 * these are stateless singletons. Keeping them in their own class rather than as a lambda inside the
 * DAO means the mapping can be unit-tested against a stub {@code ResultSet}, and that a query and
 * its mapping can change independently.
 *
 * <p>The column names below are the aliases the query assigns, not the underlying column names —
 * that is the contract between the two files.
 */
@Component
public class ReportSummaryRowMapper implements RowMapper<ReportDTOs.Summary> {

    @Override
    public ReportDTOs.Summary mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new ReportDTOs.Summary(
                rs.getLong("total_orders"),
                RowValues.money(rs.getBigDecimal("total_revenue")),
                RowValues.money(rs.getBigDecimal("average_order_value")),
                rs.getLong("items_sold"));
    }
}
