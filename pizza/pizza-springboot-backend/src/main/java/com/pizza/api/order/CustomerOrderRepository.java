package com.pizza.api.order;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CustomerOrderRepository extends JpaRepository<CustomerOrder, Long> {

    /**
     * Loads an order with its line items.
     *
     * <p>Only ONE collection is fetched here, deliberately. Adding {@code "items.toppings"} to this
     * graph throws {@link org.hibernate.loader.MultipleBagFetchException} at query time: Hibernate
     * refuses to join-fetch two {@code List} collections at once, because the result would be a
     * cartesian product it cannot de-duplicate (a List, unlike a Set, has to preserve duplicates).
     *
     * <p>The toppings are loaded separately by {@code CustomerOrderDAOImpl}, helped by the
     * {@code @BatchSize} on {@code OrderItem.toppings}.
     */
    @EntityGraph(attributePaths = "items")
    Optional<CustomerOrder> findWithItemsById(Long id);

    Optional<CustomerOrder> findByStripePaymentIntentId(String paymentIntentId);

    Page<CustomerOrder> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    Page<CustomerOrder> findAllByOrderByCreatedAtDesc(Pageable pageable);

    List<CustomerOrder> findByStatusOrderByCreatedAtDesc(OrderStatus status);

    /** Used by the reports; the status filter is applied by the caller. */
    @Query(
            """
			select o from CustomerOrder o
			where o.createdAt >= :from and o.createdAt < :to
			order by o.createdAt asc
			""")
    List<CustomerOrder> findInRange(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);
}
