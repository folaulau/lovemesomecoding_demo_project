package com.pizza.api.entity.user;

import static org.springframework.http.HttpStatus.OK;

import com.pizza.api.dto.AdminUserDTO;
import com.pizza.api.dto.UserRoleUpdateDTO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * User administration.
 *
 * <p>Under {@code /api/admin/**}, so the ADMIN role requirement is inherited from one matcher in
 * SecurityConfig rather than repeated per method.
 *
 * <p>{@code Principal} is passed through to the service so it can refuse an admin demoting or
 * deleting themselves — with one administrator, either would lock them out of their own back
 * office.
 */
@Tag(name = "Admin · Users", description = "User management (ADMIN only)")
@RequestMapping("/api/admin/users")
@RestController
@SecurityRequirement(name = "bearerAuth")
@Slf4j
public class AdminUserRestController {

    @Autowired
    private AdminUserService adminUserService;

    @Operation(summary = "List every account, newest first")
    @GetMapping
    public ResponseEntity<List<AdminUserDTO>> getUsers() {
        return new ResponseEntity<>(adminUserService.getAllUsers(), OK);
    }

    @Operation(summary = "Promote to admin, or demote back to customer")
    @PatchMapping("/{id}/role")
    public ResponseEntity<AdminUserDTO> changeRole(
            Principal principal, @PathVariable UUID id, @Valid @RequestBody UserRoleUpdateDTO dto) {
        return new ResponseEntity<>(adminUserService.changeRole(principal.getName(), id, dto.role()), OK);
    }

    @Operation(summary = "Soft-delete an account — past orders still reference it")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUser(Principal principal, @PathVariable UUID id) {
        adminUserService.deleteUser(principal.getName(), id);
        return ResponseEntity.noContent().build();
    }
}
