package com.pizza.api.entity.user;

import com.pizza.api.dto.AdminUserDTO;
import com.pizza.api.entity.order.CustomerOrderDAO;
import com.pizza.api.exception.ApiException;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * User administration.
 *
 * <p>Every method here carries {@code @PreAuthorize("hasRole('ADMIN')")} even though
 * {@code SecurityConfig} already restricts {@code /api/admin/**} to admins. That is not
 * belt-and-braces for its own sake: URL rules protect one entry point, and this service is a bean
 * that any future controller, scheduled job or message listener can inject. The annotation travels
 * with the method, so the guard cannot be left behind when the caller changes.
 *
 * <p>⚠️ Being proxy-based, it has the same blind spot as {@code @Transactional} and
 * {@code @Cacheable}: a call from another method inside THIS class skips the check entirely.
 */
@Service
@Slf4j
public class AdminUserServiceImpl implements AdminUserService {

    @Autowired
    private UserDAO userDAO;

    @Autowired
    private UserAddressRepository addressRepository;

    @Autowired
    private UserPaymentMethodRepository paymentMethodRepository;

    @Autowired
    private CustomerOrderDAO orderDAO;

    /**
     * The whole list in one query.
     *
     * <p>This used to load the users and then, per user, count their orders and load their full
     * address and card lists to measure them. {@link UserDAO#findAllForAdmin()} does the counting in
     * the database instead.
     */
    @Override
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional(readOnly = true)
    public List<AdminUserDTO> getAllUsers() {
        return userDAO.findAllForAdmin();
    }

    @Override
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public AdminUserDTO changeRole(String actingAdminEmail, UUID userId, UserRole role) {
        User target = requireUser(userId);
        refuseSelfTarget(actingAdminEmail, target, "change your own role");

        log.info("{} changing {} from {} to {}", actingAdminEmail, target.getEmail(), target.getRole(), role);
        target.setRole(role);
        return toDto(userDAO.save(target));
    }

    @Override
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public void deleteUser(String actingAdminEmail, UUID userId) {
        User target = requireUser(userId);
        refuseSelfTarget(actingAdminEmail, target, "delete your own account");

        // Soft delete. Past orders reference this row, and an order must keep reading correctly
        // long after the customer has gone.
        log.info("{} deleting {}", actingAdminEmail, target.getEmail());
        target.setDeleted(true);
        userDAO.save(target);
    }

    // ------------------------------------------------------------------ helpers

    private User requireUser(UUID userId) {
        return userDAO.findByPublicId(userId).orElseThrow(() -> ApiException.notFound("User", userId));
    }

    /**
     * An admin may not demote or delete themselves.
     *
     * <p>With a single administrator — which is the normal case for a small system — either action
     * would lock the last admin out of their own back office, with no route back in through the
     * UI. Refusing is far kinder than a support ticket and a SQL console.
     */
    private void refuseSelfTarget(String actingAdminEmail, User target, String what) {
        if (target.getEmail().equalsIgnoreCase(actingAdminEmail)) {
            throw ApiException.badRequest("You cannot " + what + " — sign in as another admin to do that.");
        }
    }

    /**
     * Builds the response for a SINGLE user that was just written.
     *
     * <p>Three counts for one row is fine; the same three counts inside a loop over every user is
     * what {@link UserDAO#findAllForAdmin()} exists to avoid.
     */
    private AdminUserDTO toDto(User user) {
        return new AdminUserDTO(
                user.getPublicId(),
                user.getEmail(),
                user.getFullName(),
                user.getRole(),
                orderDAO.countByUserId(user.getId()),
                addressRepository
                        .findByUserIdOrderByPrimaryDescCreatedAtDesc(user.getId())
                        .size(),
                paymentMethodRepository
                        .findByUserIdOrderByPrimaryDescCreatedAtDesc(user.getId())
                        .size(),
                user.getCreatedAt());
    }
}
