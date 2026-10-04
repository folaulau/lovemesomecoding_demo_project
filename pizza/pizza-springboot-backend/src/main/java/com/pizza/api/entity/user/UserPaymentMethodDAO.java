package com.pizza.api.entity.user;

import java.util.Optional;
import java.util.UUID;

/**
 * Data-access contract for saved cards. See ProductDAO for why this layer exists.
 */
public interface UserPaymentMethodDAO {

    /**
     * A saved card, but only if it belongs to this user and has not been deleted.
     *
     * <p>Returns empty for a card that exists but is someone else's — callers turn that into a 404,
     * never a 403, so the API cannot be used to confirm that a card id is real.
     */
    Optional<UserPaymentMethod> findOwned(Long userId, UUID publicId);
}
