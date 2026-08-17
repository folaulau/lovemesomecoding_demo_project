package com.pizza.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "A signed-in session")
public record AuthenticationResponseDTO(
        @Schema(description = "JWT to send as: Authorization: Bearer <token>") String token,
        @Schema(description = "Token lifetime in minutes") long expiresInMinutes,
        UserDTO user) {}
