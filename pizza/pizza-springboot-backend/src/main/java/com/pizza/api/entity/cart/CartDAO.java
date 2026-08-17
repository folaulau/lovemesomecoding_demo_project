package com.pizza.api.entity.cart;

import java.util.Optional;
import java.util.UUID;

/** Data-access contract for carts. See ProductDAO for why this layer exists. */
public interface CartDAO {

    Optional<Cart> findByPublicId(UUID publicId);

    /** Fully loaded: lines and their toppings, safe to map outside a transaction. */
    Optional<Cart> findByPublicIdWithItems(UUID publicId);

    Cart save(Cart cart);
}
