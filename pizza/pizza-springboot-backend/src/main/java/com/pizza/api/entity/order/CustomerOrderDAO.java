package com.pizza.api.entity.order;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/** Data-access contract for orders. See ProductDAO for why this layer exists. */
public interface CustomerOrderDAO {

    Optional<CustomerOrder> findByPublicId(UUID publicId);

    /** Fully loaded: items and toppings included, safe to map outside a transaction. */
    Optional<CustomerOrder> findByPublicIdWithItems(UUID publicId);

    /** Used by the Stripe webhook to find the order a payment belongs to. */
    Optional<CustomerOrder> findByPaymentIntentId(String paymentIntentId);

    Page<CustomerOrder> findByUser(Long userId, Pageable pageable);

    Page<CustomerOrder> getAll(Pageable pageable);

    List<CustomerOrder> findByStatus(OrderStatus status);

    List<CustomerOrder> findCreatedBetween(LocalDateTime from, LocalDateTime to);

    /** How many orders one account has placed — shown beside them in the admin user list. */
    long countByUserId(Long userId);

    CustomerOrder save(CustomerOrder order);
}
