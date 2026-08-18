package com.pizza.api.entity.user;

import com.pizza.api.dto.AdminUserDTO;
import java.util.List;
import java.util.UUID;

/**
 * User administration.
 *
 * <p>Every method takes the ACTING admin's email as well as the target, so the service can refuse
 * the operations that would lock an administrator out of their own system.
 */
public interface AdminUserService {

    List<AdminUserDTO> getAllUsers();

    AdminUserDTO changeRole(String actingAdminEmail, UUID userId, UserRole role);

    void deleteUser(String actingAdminEmail, UUID userId);
}
