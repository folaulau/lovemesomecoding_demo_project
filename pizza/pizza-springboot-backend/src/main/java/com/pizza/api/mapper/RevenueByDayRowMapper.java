package com.pizza.api.mapper;

import com.pizza.api.dto.ReportDTOs;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Component;

/** Maps one day of takings onto {@link ReportDTOs.RevenueByDay}. */
@Component
public class RevenueByDayRowMapper implements RowMapper<ReportDTOs.RevenueByDay> {

    /**
     * {@code getObject(col, LocalDate.class)} rather than {@code getDate}: the latter hands back a
     * {@code java.sql.Date}, dragging the JVM default timezone into a value that has no time in it.
     * That is the same class of bug that once shifted every timestamp in this app by seven hours.
     */
    @Override
    public ReportDTOs.RevenueByDay mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new ReportDTOs.RevenueByDay(
                rs.getObject("day", LocalDate.class),
                rs.getLong("orders"),
                RowValues.money(rs.getBigDecimal("revenue")));
    }
}
