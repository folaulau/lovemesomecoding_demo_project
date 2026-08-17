package com.pizza.api.entity.order;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.pizza.api.TestIds;
import com.pizza.api.payment.StripeService;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * Order placement over HTTP.
 *
 * <p>{@code @MockitoBean} replaces the real {@link StripeService} in the context. Tests must not
 * make live network calls: they would be slow, need credentials in CI, and leave junk
 * PaymentIntents in the Stripe account. Reporting the service as unconfigured exercises the
 * no-Stripe path while still proving the ordering and pricing logic end to end.
 *
 * <p>Every identifier in these request bodies is a UUID — the numeric primary key is not part of
 * the API at all.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@DisplayName("Order API")
class OrderApiIntegrationTest {

    private static final String UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private StripeService stripeService;

    @BeforeEach
    void stubStripe() {
        Mockito.when(stripeService.isConfigured()).thenReturn(false);
    }

    /** One plain Large Pepperoni, with the caller supplying the order header fields. */
    private static String plainLargePepperoni(String headerFields) {
        return """
                {%s,
                 "items":[{"productId":"%s","size":"LARGE","quantity":1}]}"""
                .formatted(headerFields, TestIds.PEPPERONI_PIZZA);
    }

    @Test
    @DisplayName("a guest can order without any token")
    void guestCanOrder() throws Exception {
        mockMvc.perform(
                        post("/api/orders")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        plainLargePepperoni(
                                                """
                                "orderType":"CARRYOUT","customerName":"Guest","guestEmail":"guest@example.com\"""")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.order.status").value("PENDING_PAYMENT"))
                .andExpect(jsonPath("$.order.email").value("guest@example.com"))
                .andExpect(jsonPath("$.order.subtotal").value(16.99))
                .andExpect(jsonPath("$.order.total").value(18.43));
    }

    @Test
    @DisplayName("the response exposes UUIDs, never the numeric primary key")
    void responseUsesUuids() throws Exception {
        mockMvc.perform(
                        post("/api/orders")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        plainLargePepperoni(
                                                """
                                "orderType":"CARRYOUT","customerName":"Guest","guestEmail":"guest@example.com\"""")))
                .andExpect(status().isCreated())
                // A UUID, not "1".
                .andExpect(jsonPath("$.order.id").value(Matchers.matchesPattern(UUID_PATTERN)))
                .andExpect(jsonPath("$.order.items[0].id").value(Matchers.matchesPattern(UUID_PATTERN)))
                .andExpect(jsonPath("$.order.items[0].productId").value(TestIds.PEPPERONI_PIZZA.toString()))
                .andExpect(jsonPath("$.order.createdAt").exists())
                .andExpect(jsonPath("$.order.updatedAt").exists());
    }

    @Test
    @DisplayName("prices sent by the client are ignored entirely")
    void clientPricesAreIgnored() throws Exception {
        // The attacker adds price fields to the JSON. They are not part of the request record, so
        // Jackson drops them and the server prices the order from the database regardless.
        mockMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                """
                                {"orderType":"CARRYOUT","customerName":"Cheapskate","guestEmail":"g@e.com",
                                 "subtotal":0.01,"tax":0.00,"total":0.01,
                                 "items":[{"productId":"%s","size":"LARGE","quantity":1,
                                           "unitPrice":0.01,"lineTotal":0.01}]}"""
                                        .formatted(TestIds.PEPPERONI_PIZZA)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.order.subtotal").value(16.99))
                .andExpect(jsonPath("$.order.total").value(18.43));
    }

    @Test
    @DisplayName("a guest must supply an email")
    void guestNeedsEmail() throws Exception {
        mockMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(plainLargePepperoni(
                                """
                                "orderType":"CARRYOUT","customerName":"Guest\"""")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("An email address is required to check out as a guest"));
    }

    @Test
    @DisplayName("delivery requires an address")
    void deliveryNeedsAddress() throws Exception {
        mockMvc.perform(
                        post("/api/orders")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        plainLargePepperoni(
                                                """
                                "orderType":"DELIVERY","customerName":"Guest","guestEmail":"g@e.com\"""")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("A delivery address is required for delivery orders"));
    }

    @Test
    @DisplayName("an empty cart is a validation failure with a field error")
    void emptyCartRejected() throws Exception {
        mockMvc.perform(
                        post("/api/orders")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        """
                                {"orderType":"CARRYOUT","customerName":"Guest","guestEmail":"g@e.com",
                                 "items":[]}"""))
                .andExpect(status().isBadRequest())
                // The ApiError envelope reports field failures as a list of ApiSubError, matching the
                // trademachine convention.
                .andExpect(jsonPath("$.errors[0].field").value("items"))
                .andExpect(jsonPath("$.errors[0].message").value("An order needs at least one item"));
    }

    @Test
    @DisplayName("an unknown topping UUID is rejected")
    void unknownToppingRejected() throws Exception {
        mockMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                """
                                {"orderType":"CARRYOUT","customerName":"Guest","guestEmail":"g@e.com",
                                 "items":[{"productId":"%s","size":"LARGE","toppingIds":["%s"],"quantity":1}]}"""
                                        .formatted(TestIds.PEPPERONI_PIZZA, TestIds.NONEXISTENT)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Unknown topping: " + TestIds.NONEXISTENT));
    }

    @Test
    @DisplayName("a malformed UUID is a client error, not a 500")
    void malformedUuidIsClientError() throws Exception {
        mockMvc.perform(
                        post("/api/orders")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        """
                                {"orderType":"CARRYOUT","customerName":"Guest","guestEmail":"g@e.com",
                                 "items":[{"productId":"not-a-uuid","size":"LARGE","quantity":1}]}"""))
                .andExpect(status().is4xxClientError());
    }

    @Test
    @DisplayName("toppings and crust are added to the unit price")
    void chargesForCrustAndToppings() throws Exception {
        // 16.99 + 2.50 stuffed crust + 1.75 bacon + 1.75 extra cheese = 22.99
        mockMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                """
                                {"orderType":"DELIVERY","customerName":"Guest","guestEmail":"g@e.com",
                                 "addressLine1":"1 Test St","city":"SLC","state":"UT","postalCode":"84101",
                                 "items":[{"productId":"%s","size":"LARGE","crustId":"%s",
                                           "toppingIds":["%s","%s"],"quantity":1}]}"""
                                        .formatted(
                                                TestIds.PEPPERONI_PIZZA,
                                                TestIds.CRUST_STUFFED,
                                                TestIds.TOPPING_BACON,
                                                TestIds.TOPPING_EXTRA_CHEESE)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.order.items[0].unitPrice").value(22.99))
                .andExpect(jsonPath("$.order.items[0].crustName").value("Stuffed Crust"))
                .andExpect(jsonPath("$.order.items[0].crustId").value(TestIds.CRUST_STUFFED.toString()))
                .andExpect(jsonPath("$.order.items[0].toppings.length()").value(2))
                .andExpect(jsonPath("$.order.subtotal").value(22.99))
                .andExpect(jsonPath("$.order.deliveryFee").value(3.99))
                .andExpect(jsonPath("$.order.total").value(28.93));
    }
}
