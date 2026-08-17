package com.pizza.api.entity.order;

import com.pizza.api.dto.OrderCreateDTO;
import com.pizza.api.dto.OrderCreateResponseDTO;
import com.pizza.api.dto.OrderDTO;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface CustomerOrderService {

    /**
     * Prices the cart, saves the order as PENDING_PAYMENT and opens a Stripe PaymentIntent.
     *
     * @param userEmail the signed-in user's email, or null for a guest checkout
     */
    OrderCreateResponseDTO createOrder(OrderCreateDTO dto, String userEmail);

    OrderDTO getOrderByPublicId(UUID id);

    /** Re-checks the payment status with Stripe. The confirmation page polls this. */
    OrderDTO refreshPaymentStatus(UUID id);

    Page<OrderDTO> getMyOrders(String userEmail, Pageable pageable);

    Page<OrderDTO> getAllOrders(Pageable pageable);

    OrderDTO updateStatus(UUID id, OrderStatus status);

    /** Called by the Stripe webhook once payment is confirmed. */
    void markPaid(String paymentIntentId);
}
