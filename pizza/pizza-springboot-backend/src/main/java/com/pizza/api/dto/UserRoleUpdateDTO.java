package com.pizza.api.dto;

import com.pizza.api.entity.user.UserRole;
import jakarta.validation.constraints.NotNull;

/** Promote a customer to admin, or demote an admin back. */
public record UserRoleUpdateDTO(@NotNull UserRole role) {}
