package com.pizza.api.mapper;

import com.pizza.api.dto.AdminUserDTO;
import com.pizza.api.entity.user.UserRole;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.UUID;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Component;

/**
 * Maps a user plus their activity counts onto {@link AdminUserDTO}.
 *
 * <p>Note what is NOT read here: the password hash. It is not in the query either, which is the
 * stronger guarantee — a column that was never selected cannot be leaked by a later careless edit to
 * this mapper.
 */
@Component
public class AdminUserRowMapper implements RowMapper<AdminUserDTO> {

    @Override
    public AdminUserDTO mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new AdminUserDTO(
                UUID.fromString(rs.getString("public_id")),
                rs.getString("email"),
                rs.getString("full_name"),
                UserRole.valueOf(rs.getString("role")),
                rs.getLong("order_count"),
                rs.getInt("address_count"),
                rs.getInt("payment_method_count"),
                rs.getObject("created_at", LocalDateTime.class));
    }
}
