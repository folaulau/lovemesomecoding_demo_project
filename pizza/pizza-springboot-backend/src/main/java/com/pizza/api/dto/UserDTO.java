package com.pizza.api.dto;

import com.pizza.api.entity.user.UserRole;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;
import java.util.UUID;

/** The safe, public view of a user. Note there is no password field of any kind. */
@Schema(description = "A user account")
public record UserDTO(UUID id, String email, String fullName, UserRole role, LocalDateTime createdAt) {}
