package com.pizza.api.entity.order;

import com.pizza.api.dto.EntityDTOMapper;
import com.pizza.api.dto.OrderCreateDTO;
import com.pizza.api.dto.OrderCreateResponseDTO;
import com.pizza.api.dto.OrderDTO;
import com.pizza.api.entity.user.User;
import com.pizza.api.entity.user.UserDAO;
import com.pizza.api.exception.ApiException;
import com.pizza.api.payment.StripeService;
import com.stripe.exception.StripeException;
import com.stripe.model.PaymentIntent;
import com.stripe.model.PaymentMethod;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Slf4j
public class CustomerOrderServiceImpl implements CustomerOrderService {

    @Autowired
    private CustomerOrderDAO orderDAO;

    @Autowired
    private UserDAO userDAO;

    @Autowired
    private EntityDTOMapper mapper;

    @Autowired
    private PricingService pricingService;

    @Autowired
    private StripeService stripeService;

    @Override
    @Transactional
    public OrderCreateResponseDTO createOrder(OrderCreateDTO dto, String userEmail) {
        // Guest checkout is the null-user path. A signed-in order attaches the account instead.
        User user = userEmail == null ? null : userDAO.findByEmail(userEmail).orElse(null);

        if (user == null && (dto.guestEmail() == null || dto.guestEmail().isBlank())) {
            throw ApiException.badRequest("An email address is required to check out as a guest");
        }
        if (dto.orderType() == OrderType.DELIVERY
                && (dto.addressLine1() == null || dto.addressLine1().isBlank())) {
            throw ApiException.badRequest("A delivery address is required for delivery orders");
        }

        // Every figure below comes from the database, never from the request.
        PricingService.PricedOrder priced = pricingService.price(dto);

        CustomerOrder order = CustomerOrder.builder()
                .user(user)
                .guestEmail(user == null ? dto.guestEmail() : null)
                .customerName(dto.customerName())
                .phone(dto.phone())
                .orderType(dto.orderType())
                .status(OrderStatus.PENDING_PAYMENT)
                .addressLine1(dto.addressLine1())
                .addressLine2(dto.addressLine2())
                .city(dto.city())
                .state(dto.state())
                .postalCode(dto.postalCode())
                .subtotal(priced.subtotal())
                .tax(priced.tax())
                .deliveryFee(priced.deliveryFee())
                .total(priced.total())
                .build();

        priced.items().forEach(order::addItem);

        // Saved BEFORE talking to Stripe, so the PaymentIntent can carry a real order id and an
        // abandoned checkout still leaves a record.
        CustomerOrder saved = orderDAO.save(order);
        log.info("Created order {} for {}", saved.getPublicId(), saved.contactEmail());

        String clientSecret = null;
        if (stripeService.isConfigured()) {
            try {
                PaymentIntent intent =
                        stripeService.createPaymentIntent(saved.getTotal(), saved.getPublicId(), saved.contactEmail());
                saved.setStripePaymentIntentId(intent.getId());
                orderDAO.save(saved);
                clientSecret = intent.getClientSecret();
            } catch (StripeException ex) {
                log.error("Stripe rejected the PaymentIntent for order {}", saved.getPublicId(), ex);
                throw ApiException.badRequest("Could not start payment: " + ex.getMessage());
            }
        } else {
            log.warn("Stripe is not configured — order {} created without a PaymentIntent", saved.getPublicId());
        }

        return new OrderCreateResponseDTO(toDtoWithItems(saved.getPublicId()), clientSecret);
    }

    @Override
    @Transactional(readOnly = true)
    public OrderDTO getOrderByPublicId(UUID id) {
        return toDtoWithItems(id);
    }

    /**
     * Asks Stripe directly rather than trusting our own record.
     *
     * <p>The confirmation page polls this because webhooks do not reach localhost unless
     * {@code stripe listen} is running — and even in production a webhook can be delayed.
     */
    @Override
    @Transactional
    public OrderDTO refreshPaymentStatus(UUID id) {
        CustomerOrder order = orderDAO.findByPublicId(id).orElseThrow(() -> ApiException.notFound("Order", id));

        if (order.getStatus() == OrderStatus.PENDING_PAYMENT
                && order.getStripePaymentIntentId() != null
                && stripeService.isConfigured()) {
            try {
                PaymentIntent intent = stripeService.retrieve(order.getStripePaymentIntentId());
                if ("succeeded".equals(intent.getStatus())) {
                    order.setStatus(OrderStatus.PAID);
                    captureCardDetails(order, intent);
                    orderDAO.save(order);
                }
            } catch (StripeException ex) {
                log.warn("Could not refresh payment status for order {}", id, ex);
            }
        }

        return toDtoWithItems(id);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<OrderDTO> getMyOrders(String userEmail, Pageable pageable) {
        User user =
                userDAO.findByEmail(userEmail).orElseThrow(() -> ApiException.notFound("No account for " + userEmail));
        return orderDAO.findByUser(user.getId(), pageable).map(mapper::mapCustomerOrderToOrderDTO);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<OrderDTO> getAllOrders(Pageable pageable) {
        return orderDAO.getAll(pageable).map(mapper::mapCustomerOrderToOrderDTO);
    }

    @Override
    @Transactional
    public OrderDTO updateStatus(UUID id, OrderStatus status) {
        CustomerOrder order = orderDAO.findByPublicId(id).orElseThrow(() -> ApiException.notFound("Order", id));
        log.info("Order {} moving {} -> {}", id, order.getStatus(), status);
        order.setStatus(status);
        orderDAO.save(order);
        return toDtoWithItems(id);
    }

    @Override
    @Transactional
    public void markPaid(String paymentIntentId) {
        orderDAO.findByPaymentIntentId(paymentIntentId)
                .ifPresentOrElse(
                        order -> {
                            // Webhooks can be delivered more than once, so this must be idempotent:
                            // only move an order forward from PENDING_PAYMENT.
                            if (order.getStatus() == OrderStatus.PENDING_PAYMENT) {
                                order.setStatus(OrderStatus.PAID);
                                try {
                                    captureCardDetails(order, stripeService.retrieve(paymentIntentId));
                                } catch (StripeException ex) {
                                    log.warn("Could not read card details for {}", paymentIntentId, ex);
                                }
                                orderDAO.save(order);
                                log.info("Order {} marked PAID via webhook", order.getPublicId());
                            } else {
                                log.info(
                                        "Ignoring duplicate webhook for order {} (already {})",
                                        order.getPublicId(),
                                        order.getStatus());
                            }
                        },
                        () -> log.warn("Webhook referenced unknown PaymentIntent {}", paymentIntentId));
    }

    /**
     * Records WHICH card paid, for display on the confirmation page and order history.
     *
     * <p>Only the brand and last four digits are kept — the same display metadata Stripe reports.
     * The order deliberately does not keep the payment-method token: it needs to say which card was
     * used, never to be able to charge it again.
     *
     * <p>Best-effort. A failure here must never stop an order being marked paid — the customer's
     * money has already moved, and a missing "Visa ending 4242" is cosmetic.
     */
    private void captureCardDetails(CustomerOrder order, PaymentIntent intent) {
        try {
            String paymentMethodId = intent.getPaymentMethod();
            if (paymentMethodId == null) {
                return;
            }

            PaymentMethod method = stripeService.retrievePaymentMethod(paymentMethodId);
            PaymentMethod.Card card = method.getCard();

            if (card != null) {
                order.setCardBrand(card.getBrand());
                order.setCardLast4(card.getLast4());
                return;
            }

            /*
             * Not every payment method is a card.
             *
             * Stripe Elements also offers wallets — Link, Cash App Pay, Klarna — and those have no
             * `card` object at all, not on the PaymentMethod and not on the Charge either. Assuming
             * a card is always there is why this silently recorded nothing at first.
             *
             * So fall back to the payment method's TYPE. "Paid with Link" is honest and useful;
             * inventing a last4 that Stripe never gave us would not be.
             */
            order.setCardBrand(method.getType());
            order.setCardLast4(null);
        } catch (StripeException ex) {
            log.warn("Could not read the payment method used for order {}", order.getPublicId(), ex);
        }
    }

    private OrderDTO toDtoWithItems(UUID id) {
        return orderDAO.findByPublicIdWithItems(id)
                .map(mapper::mapCustomerOrderToOrderDTO)
                .orElseThrow(() -> ApiException.notFound("Order", id));
    }
}
