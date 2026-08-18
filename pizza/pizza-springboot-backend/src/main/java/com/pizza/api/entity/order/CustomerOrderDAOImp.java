package com.pizza.api.entity.order;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Repository
public class CustomerOrderDAOImp implements CustomerOrderDAO {

    @Autowired
    private CustomerOrderRepository customerOrderRepository;

    @Override
    public Optional<CustomerOrder> findByPublicId(UUID publicId) {
        return customerOrderRepository.findByPublicId(publicId);
    }

    /**
     * Two steps on purpose. The entity graph fetches the line items; the toppings then have to be
     * initialised separately, because Hibernate cannot join-fetch two List collections in one
     * query. {@code @BatchSize(25)} on the toppings collection keeps that second step to roughly
     * one extra query rather than one per item.
     */
    @Override
    @Transactional(readOnly = true)
    public Optional<CustomerOrder> findByPublicIdWithItems(UUID publicId) {
        Optional<CustomerOrder> order = customerOrderRepository.findWithItemsByPublicId(publicId);
        // Touching size() forces the lazy collection to load while the session is still open,
        // so callers can safely map the result after the transaction ends.
        order.ifPresent(o -> o.getItems().forEach(item -> item.getToppings().size()));
        return order;
    }

    @Override
    public Optional<CustomerOrder> findByPaymentIntentId(String paymentIntentId) {
        return customerOrderRepository.findByStripePaymentIntentId(paymentIntentId);
    }

    @Override
    public Page<CustomerOrder> findByUser(Long userId, Pageable pageable) {
        return customerOrderRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable);
    }

    @Override
    public Page<CustomerOrder> getAll(Pageable pageable) {
        return customerOrderRepository.findAllByOrderByCreatedAtDesc(pageable);
    }

    @Override
    public List<CustomerOrder> findByStatus(OrderStatus status) {
        return customerOrderRepository.findByStatusOrderByCreatedAtDesc(status);
    }

    @Override
    public List<CustomerOrder> findCreatedBetween(LocalDateTime from, LocalDateTime to) {
        return customerOrderRepository.findInRange(from, to);
    }

    @Override
    public long countByUserId(Long userId) {
        return customerOrderRepository.countByUserId(userId);
    }

    @Override
    public CustomerOrder save(CustomerOrder order) {
        return customerOrderRepository.saveAndFlush(order);
    }
}
