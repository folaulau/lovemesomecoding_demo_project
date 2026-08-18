package com.pizza.api.dto;

import com.pizza.api.entity.user.UserRole;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A user account as an admin sees it.
 *
 * <p>Still no password hash — an admin has no more business reading one than anybody else. The
 * extra fields over {@link UserDTO} are operational context: when they joined, how much they have
 * ordered, and whether they have saved anything.
 */
@Schema(description = "A user account, for administration")
public record AdminUserDTO(
        UUID id,
        String email,
        String fullName,
        UserRole role,
        long orderCount,
        int addressCount,
        int paymentMethodCount,
        LocalDateTime createdAt) {}
