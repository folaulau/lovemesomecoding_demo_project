package com.pizza.api.mapper;

import com.pizza.api.dto.ReportDTOs;
import java.sql.ResultSet;
import java.sql.SQLException;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Component;

/**
 * Maps a best-seller row onto {@link ReportDTOs.TopProduct}.
 *
 * <p>{@code product_name} is the name SNAPSHOTTED onto the order line, not a join back to the
 * product table — a product deleted from the menu still has to appear in historical sales.
 */
@Component
public class TopProductRowMapper implements RowMapper<ReportDTOs.TopProduct> {

    @Override
    public ReportDTOs.TopProduct mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new ReportDTOs.TopProduct(
                rs.getString("product_name"), rs.getLong("units_sold"), RowValues.money(rs.getBigDecimal("revenue")));
    }
}
