package com.pizza.api.entity.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.pizza.api.TestIds;
import com.pizza.api.entity.user.User;
import com.pizza.api.entity.user.UserDAO;
import com.pizza.api.entity.user.UserPaymentMethod;
import com.pizza.api.entity.user.UserPaymentMethodRepository;
import com.pizza.api.exception.ApiException;
import com.pizza.api.payment.StripeService;
import com.stripe.exception.ApiConnectionException;
import java.time.YearMonth;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pay-with-a-saved-card, one test per check in {@code useSavedPaymentMethod}.
 *
 * <p>Stripe is a {@code @MockitoBean}: no network calls, and the success case can assert exactly
 * which three ids would have been sent. Every rejection also asserts Stripe was NEVER asked to
 * update anything — a check that throws after the call would still be a bug.
 *
 * <p>Seeded order 1 belongs to the demo customer and is moved back to PENDING_PAYMENT here; the
 * cards and the Stripe customer id are created per test. {@code @Transactional} rolls all of it back.
 */
@SpringBootTest
@Transactional
@DisplayName("CustomerOrderService · saved card")
class CustomerOrderSavedCardTest {

    private static final String INTENT = "pi_test_saved";
    private static final String STRIPE_CUSTOMER = "cus_test_customer";

    @Autowired
    private CustomerOrderService orderService;

    @Autowired
    private CustomerOrderDAO orderDAO;

    @Autowired
    private UserDAO userDAO;

    @Autowired
    private UserPaymentMethodRepository paymentMethodRepository;

    @MockitoBean
    private StripeService stripeService;

    private User customer;

    private User admin;

    private CustomerOrder order;

    @BeforeEach
    void setUp() {
        when(stripeService.isConfigured()).thenReturn(true);

        customer = userDAO.findByEmail("customer@pizza.test").orElseThrow();
        customer.setStripeCustomerId(STRIPE_CUSTOMER);
        customer = userDAO.save(customer);
        admin = userDAO.findByEmail("admin@pizza.test").orElseThrow();

        order = awaitingPayment(TestIds.ORDER_CUSTOMER_DELIVERY);
    }

    private CustomerOrder awaitingPayment(UUID orderId) {
        CustomerOrder o = orderDAO.findByPublicId(orderId).orElseThrow();
        o.setStatus(OrderStatus.PENDING_PAYMENT);
        o.setStripePaymentIntentId(INTENT);
        return orderDAO.save(o);
    }

    private UserPaymentMethod saveCard(User owner, String token, int expMonth, int expYear, boolean deleted) {
        return paymentMethodRepository.saveAndFlush(UserPaymentMethod.builder()
                .user(owner)
                .stripePaymentMethodId(token)
                .brand("visa")
                .last4("4242")
                .expMonth(expMonth)
                .expYear(expYear)
                .deleted(deleted)
                .build());
    }

    private UserPaymentMethod validCard(User owner, String token) {
        return saveCard(owner, token, 12, YearMonth.now().getYear() + 3, false);
    }

    /** Runs the call, asserts it was refused with {@code status}, and that Stripe was never touched. */
    // `throws Exception` only because the Stripe method declares StripeException; a mock never throws it here.
    private void refused(HttpStatus status, UUID orderId, UUID cardId, String email) throws Exception {
        ApiException ex = catchThrowableOfType(
                ApiException.class, () -> orderService.useSavedPaymentMethod(orderId, cardId, email));

        assertThat(ex).as("expected an ApiException").isNotNull();
        assertThat(ex.getError().getStatus()).isEqualTo(status);
        verify(stripeService, never()).attachSavedCardToPaymentIntent(anyString(), anyString(), anyString());
    }

    // ------------------------------------------------------------------ success

    @Test
    @DisplayName("sends the intent, the Stripe customer and the card token to Stripe")
    void attachesTheCard() throws Exception {
        UserPaymentMethod card = validCard(customer, "pm_test_visa");

        orderService.useSavedPaymentMethod(order.getPublicId(), card.getPublicId(), "customer@pizza.test");

        verify(stripeService).attachSavedCardToPaymentIntent(INTENT, STRIPE_CUSTOMER, "pm_test_visa");
        // Nothing is charged or recorded yet — the order is still waiting for payment.
        assertThat(orderDAO.findByPublicId(order.getPublicId()).orElseThrow().getStatus())
                .isEqualTo(OrderStatus.PENDING_PAYMENT);
    }

    @Test
    @DisplayName("a card in its expiry month is still accepted")
    void acceptsCardInItsExpiryMonth() throws Exception {
        YearMonth now = YearMonth.now();
        UserPaymentMethod card = saveCard(customer, "pm_test_this_month", now.getMonthValue(), now.getYear(), false);

        orderService.useSavedPaymentMethod(order.getPublicId(), card.getPublicId(), "customer@pizza.test");

        verify(stripeService).attachSavedCardToPaymentIntent(INTENT, STRIPE_CUSTOMER, "pm_test_this_month");
    }

    // -------------------------------------------------------- who and which order

    @Test
    @DisplayName("401 without a signed-in user")
    void requiresSignIn() throws Exception {
        UserPaymentMethod card = validCard(customer, "pm_test_visa");
        refused(HttpStatus.UNAUTHORIZED, order.getPublicId(), card.getPublicId(), null);
    }

    @Test
    @DisplayName("404 for an order that does not exist")
    void unknownOrder() throws Exception {
        UserPaymentMethod card = validCard(customer, "pm_test_visa");
        refused(HttpStatus.NOT_FOUND, TestIds.NONEXISTENT, card.getPublicId(), "customer@pizza.test");
    }

    @Test
    @DisplayName("404, not 403, for a guest order")
    void guestOrder() throws Exception {
        CustomerOrder guestOrder = awaitingPayment(TestIds.ORDER_GUEST_CARRYOUT);
        UserPaymentMethod card = validCard(customer, "pm_test_visa");

        refused(HttpStatus.NOT_FOUND, guestOrder.getPublicId(), card.getPublicId(), "customer@pizza.test");
    }

    @Test
    @DisplayName("404, not 403, for another customer's order")
    void someoneElsesOrder() throws Exception {
        UserPaymentMethod adminsCard = validCard(admin, "pm_test_admin");

        refused(HttpStatus.NOT_FOUND, order.getPublicId(), adminsCard.getPublicId(), "admin@pizza.test");
    }

    @Test
    @DisplayName("409 once the order is no longer awaiting payment")
    void orderAlreadyPaid() throws Exception {
        order.setStatus(OrderStatus.PAID);
        orderDAO.save(order);
        UserPaymentMethod card = validCard(customer, "pm_test_visa");

        refused(HttpStatus.CONFLICT, order.getPublicId(), card.getPublicId(), "customer@pizza.test");
    }

    // ------------------------------------------------------------ payment set-up

    @Test
    @DisplayName("400 when Stripe is not configured")
    void stripeNotConfigured() throws Exception {
        when(stripeService.isConfigured()).thenReturn(false);
        UserPaymentMethod card = validCard(customer, "pm_test_visa");

        refused(HttpStatus.BAD_REQUEST, order.getPublicId(), card.getPublicId(), "customer@pizza.test");
    }

    @Test
    @DisplayName("400 when the order has no PaymentIntent")
    void orderWithoutIntent() throws Exception {
        order.setStripePaymentIntentId(null);
        orderDAO.save(order);
        UserPaymentMethod card = validCard(customer, "pm_test_visa");

        refused(HttpStatus.BAD_REQUEST, order.getPublicId(), card.getPublicId(), "customer@pizza.test");
    }

    // ------------------------------------------------------------------- the card

    @Test
    @DisplayName("404, not 403, for another customer's card")
    void someoneElsesCard() throws Exception {
        UserPaymentMethod adminsCard = validCard(admin, "pm_test_admin");
        refused(HttpStatus.NOT_FOUND, order.getPublicId(), adminsCard.getPublicId(), "customer@pizza.test");
    }

    @Test
    @DisplayName("404 for a deleted card")
    void deletedCard() throws Exception {
        UserPaymentMethod deleted =
                saveCard(customer, "pm_test_deleted", 12, YearMonth.now().getYear() + 3, true);
        refused(HttpStatus.NOT_FOUND, order.getPublicId(), deleted.getPublicId(), "customer@pizza.test");
    }

    @Test
    @DisplayName("404 for a card id that was never saved")
    void unknownCard() throws Exception {
        refused(HttpStatus.NOT_FOUND, order.getPublicId(), UUID.randomUUID(), "customer@pizza.test");
    }

    @Test
    @DisplayName("400 for an expired card, even though the checkout already greys it out")
    void expiredCard() throws Exception {
        YearMonth lastMonth = YearMonth.now().minusMonths(1);
        UserPaymentMethod expired =
                saveCard(customer, "pm_test_expired", lastMonth.getMonthValue(), lastMonth.getYear(), false);

        refused(HttpStatus.BAD_REQUEST, order.getPublicId(), expired.getPublicId(), "customer@pizza.test");
    }

    @Test
    @DisplayName("400 when the account has no Stripe customer to charge the card through")
    void noStripeCustomer() throws Exception {
        customer.setStripeCustomerId(null);
        userDAO.save(customer);
        UserPaymentMethod card = validCard(customer, "pm_test_visa");

        refused(HttpStatus.BAD_REQUEST, order.getPublicId(), card.getPublicId(), "customer@pizza.test");
    }

    // ------------------------------------------------------------- Stripe refuses

    @Test
    @DisplayName("400 with a generic message when Stripe refuses — and the order is untouched")
    void stripeRefuses() throws Exception {
        UserPaymentMethod card = validCard(customer, "pm_test_visa");
        when(stripeService.attachSavedCardToPaymentIntent(INTENT, STRIPE_CUSTOMER, "pm_test_visa"))
                .thenThrow(new ApiConnectionException("internal Stripe detail the customer must not see"));

        ApiException ex = catchThrowableOfType(
                ApiException.class,
                () -> orderService.useSavedPaymentMethod(
                        order.getPublicId(), card.getPublicId(), "customer@pizza.test"));

        assertThat(ex).isNotNull();
        assertThat(ex.getError().getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(ex.getMessage()).doesNotContain("internal Stripe detail");
        assertThat(orderDAO.findByPublicId(order.getPublicId()).orElseThrow().getStatus())
                .isEqualTo(OrderStatus.PENDING_PAYMENT);
    }
}
