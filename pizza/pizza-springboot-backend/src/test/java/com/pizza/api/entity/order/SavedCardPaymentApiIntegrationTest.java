package com.pizza.api.entity.order;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pizza.api.TestIds;
import com.pizza.api.entity.user.User;
import com.pizza.api.entity.user.UserDAO;
import com.pizza.api.entity.user.UserPaymentMethod;
import com.pizza.api.entity.user.UserPaymentMethodRepository;
import com.pizza.api.payment.StripeService;
import java.time.YearMonth;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code PUT /api/orders/{id}/payment-method} over HTTP, with real login tokens.
 *
 * <p>{@code CustomerOrderSavedCardTest} covers every rule in the service. This class proves the
 * HTTP layer around it: the security rule, request validation, and that each refusal arrives as
 * the right status code. Stripe is a {@code @MockitoBean}, so nothing leaves the machine.
 *
 * <p>Seeded order 1 belongs to the demo customer and is moved back to PENDING_PAYMENT; cards are
 * created per test. MockMvc runs requests on the test's thread, so they share its transaction and
 * everything is rolled back afterwards.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@DisplayName("Saved-card payment API")
class SavedCardPaymentApiIntegrationTest {

    private static final String INTENT = "pi_test_saved";
    private static final String STRIPE_CUSTOMER = "cus_test_customer";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private CustomerOrderDAO orderDAO;

    @Autowired
    private UserDAO userDAO;

    @Autowired
    private UserPaymentMethodRepository paymentMethodRepository;

    @MockitoBean
    private StripeService stripeService;

    // Constructed rather than @Autowired, for the reason given in ApiSecurityIntegrationTest.
    private final ObjectMapper objectMapper = new ObjectMapper();

    private User customer;

    private User admin;

    private CustomerOrder order;

    private String customerToken;

    @BeforeEach
    void setUp() throws Exception {
        when(stripeService.isConfigured()).thenReturn(true);

        customer = userDAO.findByEmail("customer@pizza.test").orElseThrow();
        customer.setStripeCustomerId(STRIPE_CUSTOMER);
        customer = userDAO.save(customer);
        admin = userDAO.findByEmail("admin@pizza.test").orElseThrow();

        order = awaitingPayment(TestIds.ORDER_CUSTOMER_DELIVERY);
        customerToken = tokenFor("customer@pizza.test", "pizza123");
    }

    private String tokenFor(String email, String password) throws Exception {
        String body = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"%s"}"""
                                .formatted(email, password)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(body).get("token").asText();
    }

    private CustomerOrder awaitingPayment(UUID orderId) {
        CustomerOrder o = orderDAO.findByPublicId(orderId).orElseThrow();
        o.setStatus(OrderStatus.PENDING_PAYMENT);
        o.setStripePaymentIntentId(INTENT);
        return orderDAO.save(o);
    }

    private UserPaymentMethod saveCard(User owner, String token, YearMonth expiry, boolean deleted) {
        return paymentMethodRepository.saveAndFlush(UserPaymentMethod.builder()
                .user(owner)
                .stripePaymentMethodId(token)
                .brand("visa")
                .last4("4242")
                .expMonth(expiry.getMonthValue())
                .expYear(expiry.getYear())
                .deleted(deleted)
                .build());
    }

    private UserPaymentMethod validCard(User owner, String token) {
        return saveCard(owner, token, YearMonth.now().plusYears(3), false);
    }

    /** PUT with a raw body, so the validation tests can send something malformed. */
    private ResultActions putBody(UUID orderId, String body, String token) throws Exception {
        var request = put("/api/orders/{id}/payment-method", orderId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body);
        if (token != null) {
            request.header("Authorization", "Bearer " + token);
        }
        return mockMvc.perform(request);
    }

    private ResultActions payWith(UUID orderId, UUID cardId, String token) throws Exception {
        return putBody(orderId, """
                {"paymentMethodId":"%s"}""".formatted(cardId), token);
    }

    private void stripeWasNeverCalled() throws Exception {
        verify(stripeService, never()).attachSavedCardToPaymentIntent(anyString(), anyString(), anyString());
    }

    // ------------------------------------------------------------------ success

    @Test
    @DisplayName("204 for the customer's own card on their own order, and Stripe gets the token")
    void paysWithOwnCard() throws Exception {
        UserPaymentMethod card = validCard(customer, "pm_test_visa");

        payWith(order.getPublicId(), card.getPublicId(), customerToken).andExpect(status().isNoContent());

        verify(stripeService).attachSavedCardToPaymentIntent(INTENT, STRIPE_CUSTOMER, "pm_test_visa");
    }

    // ----------------------------------------------------------------- security

    /*
     * 403, not 401. That is this app's existing behaviour for ANY protected endpoint called without
     * a token — no AuthenticationEntryPoint is configured, so Spring Security answers 403. See
     * ApiSecurityIntegrationTest.adminRequiresToken, which asserts the same.
     */
    @Test
    @DisplayName("refused without a token (403, as every protected endpoint here is)")
    void requiresToken() throws Exception {
        UserPaymentMethod card = validCard(customer, "pm_test_visa");

        payWith(order.getPublicId(), card.getPublicId(), null).andExpect(status().isForbidden());

        stripeWasNeverCalled();
    }

    @Test
    @DisplayName("404, not 403, for a guest's order")
    void guestOrder() throws Exception {
        CustomerOrder guestOrder = awaitingPayment(TestIds.ORDER_GUEST_CARRYOUT);
        UserPaymentMethod card = validCard(customer, "pm_test_visa");

        payWith(guestOrder.getPublicId(), card.getPublicId(), customerToken).andExpect(status().isNotFound());

        stripeWasNeverCalled();
    }

    @Test
    @DisplayName("404, not 403, for another customer's card")
    void someoneElsesCard() throws Exception {
        UserPaymentMethod adminsCard = validCard(admin, "pm_test_admin");

        payWith(order.getPublicId(), adminsCard.getPublicId(), customerToken).andExpect(status().isNotFound());

        stripeWasNeverCalled();
    }

    @Test
    @DisplayName("404 for the customer's own card once it is deleted")
    void deletedCard() throws Exception {
        UserPaymentMethod deleted =
                saveCard(customer, "pm_test_deleted", YearMonth.now().plusYears(3), true);

        payWith(order.getPublicId(), deleted.getPublicId(), customerToken).andExpect(status().isNotFound());

        stripeWasNeverCalled();
    }

    // -------------------------------------------------------- the card and order

    @Test
    @DisplayName("400 for an expired card")
    void expiredCard() throws Exception {
        UserPaymentMethod expired =
                saveCard(customer, "pm_test_expired", YearMonth.now().minusMonths(1), false);

        payWith(order.getPublicId(), expired.getPublicId(), customerToken).andExpect(status().isBadRequest());

        stripeWasNeverCalled();
    }

    @Test
    @DisplayName("409 once the order is paid")
    void orderAlreadyPaid() throws Exception {
        order.setStatus(OrderStatus.PAID);
        orderDAO.save(order);
        UserPaymentMethod card = validCard(customer, "pm_test_visa");

        payWith(order.getPublicId(), card.getPublicId(), customerToken).andExpect(status().isConflict());

        stripeWasNeverCalled();
    }

    // --------------------------------------------------------------- validation

    @Test
    @DisplayName("400 when the body is missing, or has no card id")
    void missingBody() throws Exception {
        putBody(order.getPublicId(), "", customerToken).andExpect(status().isBadRequest());
        putBody(order.getPublicId(), "{}", customerToken).andExpect(status().isBadRequest());

        stripeWasNeverCalled();
    }
}
