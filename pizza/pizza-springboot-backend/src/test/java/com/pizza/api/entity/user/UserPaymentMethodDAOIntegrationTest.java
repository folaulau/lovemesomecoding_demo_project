package com.pizza.api.entity.user;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * The saved-card lookup checkout will use to turn our card id into a Stripe token.
 *
 * <p>The seed data has no saved cards, so each test creates its own. {@code @Transactional} rolls
 * them back afterwards, which is what keeps this from poisoning later runs.
 */
@SpringBootTest
@Transactional
@DisplayName("UserPaymentMethodDAO")
class UserPaymentMethodDAOIntegrationTest {

    @Autowired
    private UserPaymentMethodDAO paymentMethodDAO;

    @Autowired
    private UserPaymentMethodRepository paymentMethodRepository;

    @Autowired
    private UserDAO userDAO;

    private User customer;

    private User admin;

    @BeforeEach
    void loadUsers() {
        customer = userDAO.findByEmail("customer@pizza.test").orElseThrow();
        admin = userDAO.findByEmail("admin@pizza.test").orElseThrow();
    }

    private UserPaymentMethod saveCard(User owner, String token, boolean deleted) {
        return paymentMethodRepository.saveAndFlush(UserPaymentMethod.builder()
                .user(owner)
                .stripePaymentMethodId(token)
                .brand("visa")
                .last4("4242")
                .expMonth(12)
                .expYear(2030)
                .deleted(deleted)
                .build());
    }

    @Test
    @DisplayName("finds a card that belongs to the caller")
    void findsOwnCard() {
        UserPaymentMethod card = saveCard(customer, "pm_test_own", false);

        assertThat(paymentMethodDAO.findOwned(customer.getId(), card.getPublicId()))
                .get()
                .extracting(UserPaymentMethod::getStripePaymentMethodId)
                .isEqualTo("pm_test_own");
    }

    @Test
    @DisplayName("does not find another user's card — it looks exactly like a missing one")
    void ignoresSomeoneElsesCard() {
        UserPaymentMethod adminsCard = saveCard(admin, "pm_test_admin", false);

        assertThat(paymentMethodDAO.findOwned(customer.getId(), adminsCard.getPublicId()))
                .isEmpty();
    }

    @Test
    @DisplayName("does not find a soft-deleted card")
    void ignoresDeletedCard() {
        UserPaymentMethod deleted = saveCard(customer, "pm_test_deleted", true);

        assertThat(paymentMethodDAO.findOwned(customer.getId(), deleted.getPublicId()))
                .isEmpty();
    }

    @Test
    @DisplayName("does not find an id that was never saved")
    void ignoresUnknownId() {
        assertThat(paymentMethodDAO.findOwned(customer.getId(), UUID.randomUUID()))
                .isEmpty();
    }
}
