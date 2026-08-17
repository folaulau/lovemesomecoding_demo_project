package com.pizza.api.order;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/** Data-access contract for orders. See ProductDAO for why this layer exists. */
public interface CustomerOrderDAO {

    Optional<CustomerOrder> findById(Long id);

    /** Fully loaded: items and toppings included, safe to map outside a transaction. */
    Optional<CustomerOrder> findByIdWithItems(Long id);

    /** Used by the Stripe webhook to find the order a payment belongs to. */
    Optional<CustomerOrder> findByPaymentIntentId(String paymentIntentId);

    Page<CustomerOrder> findByUser(Long userId, Pageable pageable);

    Page<CustomerOrder> findAll(Pageable pageable);

    List<CustomerOrder> findByStatus(OrderStatus status);

    List<CustomerOrder> findCreatedBetween(LocalDateTime from, LocalDateTime to);

    CustomerOrder save(CustomerOrder order);
}
