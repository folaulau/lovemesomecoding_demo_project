package com.pizza.api.entity.user;

import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

/**
 * Saved cards. Same layout as {@link UserDAOImp}, but repository-only for now: everything here is a
 * single-row lookup, which is the repository's job — it returns a managed entity and honours the
 * {@code @SQLRestriction} that hides soft-deleted cards. Add a JdbcTemplate when a query needs one,
 * and remember hand-written SQL must filter {@code deleted = 0} itself.
 */
@Repository
public class UserPaymentMethodDAOImp implements UserPaymentMethodDAO {

    @Autowired
    private UserPaymentMethodRepository paymentMethodRepository;

    // ------------------------------------------------- repository: the simple things

    @Override
    public Optional<UserPaymentMethod> findOwned(Long userId, UUID publicId) {
        return paymentMethodRepository.findByPublicIdAndUserId(publicId, userId);
    }
}
