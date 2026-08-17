package com.pizza.api.entity.cart;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CartRepository extends JpaRepository<Cart, Long> {

    /**
     * Fetches the cart with its lines. Only ONE collection is join-fetched — the toppings are
     * initialised separately, because Hibernate refuses to join-fetch two List collections at once
     * (MultipleBagFetchException). Same pattern as CustomerOrderRepository.
     */
    @EntityGraph(attributePaths = "items")
    Optional<Cart> findWithItemsByPublicId(UUID publicId);

    Optional<Cart> findByPublicId(UUID publicId);

    /** Abandoned carts, for a future cleanup job. */
    List<Cart> findByUpdatedAtBefore(LocalDateTime cutoff);
}
