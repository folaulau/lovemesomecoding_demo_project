package com.pizza.api.order;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;

/** Exercises the order data-access layer against the seeded demo orders. */
@SpringBootTest
@Transactional
@DisplayName("CustomerOrderDAO")
class CustomerOrderDAOIntegrationTest {

    @Autowired
    private CustomerOrderDAO orderDAO;

    @Test
    @DisplayName("loads an order together with its items and toppings")
    void loadsOrderGraph() {
        CustomerOrder order = orderDAO.findByIdWithItems(1L).orElseThrow();

        assertThat(order.getItems()).isNotEmpty();
        assertThat(order.getItems()).allSatisfy(i -> {
            assertThat(i.getProductName()).isNotBlank();
            assertThat(i.getLineTotal()).isNotNull();
        });
    }

    @Test
    @DisplayName("stored subtotal equals the sum of its line totals")
    void subtotalMatchesLineItems() {
        CustomerOrder order = orderDAO.findByIdWithItems(11L).orElseThrow();

        BigDecimal sumOfLines =
                order.getItems().stream().map(OrderItem::getLineTotal).reduce(BigDecimal.ZERO, BigDecimal::add);

        assertThat(order.getSubtotal()).isEqualByComparingTo(sumOfLines);
        assertThat(order.getTotal())
                .isEqualByComparingTo(order.getSubtotal().add(order.getTax()).add(order.getDeliveryFee()));
    }

    @Test
    @DisplayName("a guest order has no user but does have an email")
    void supportsGuestOrders() {
        CustomerOrder guestOrder = orderDAO.findById(2L).orElseThrow();

        assertThat(guestOrder.isGuestOrder()).isTrue();
        assertThat(guestOrder.getUser()).isNull();
        assertThat(guestOrder.getGuestEmail()).isNotBlank();
        assertThat(guestOrder.contactEmail()).isEqualTo(guestOrder.getGuestEmail());
    }

    @Test
    @DisplayName("a logged-in order resolves its contact email from the user")
    void resolvesContactEmailFromUser() {
        CustomerOrder userOrder = orderDAO.findById(1L).orElseThrow();

        assertThat(userOrder.isGuestOrder()).isFalse();
        assertThat(userOrder.contactEmail()).isEqualTo("customer@pizza.test");
    }

    @Test
    @DisplayName("finds an order by its Stripe payment intent, as the webhook does")
    void findsByPaymentIntent() {
        assertThat(orderDAO.findByPaymentIntentId("pi_demo_0001")).isPresent();
        assertThat(orderDAO.findByPaymentIntentId("pi_does_not_exist")).isEmpty();
    }

    @Test
    @DisplayName("pages a user's order history newest first")
    void pagesUserHistory() {
        Page<CustomerOrder> page = orderDAO.findByUser(2L, PageRequest.of(0, 5));

        assertThat(page.getContent()).isNotEmpty();
        assertThat(page.getContent())
                .isSortedAccordingTo((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()));
    }

    @Test
    @DisplayName("filters by status, and only revenue states count toward reports")
    void filtersByStatus() {
        List<CustomerOrder> cancelled = orderDAO.findByStatus(OrderStatus.CANCELLED);

        assertThat(cancelled).hasSize(2);
        assertThat(cancelled)
                .allSatisfy(o -> assertThat(o.getStatus().countsAsRevenue()).isFalse());
        assertThat(OrderStatus.COMPLETED.countsAsRevenue()).isTrue();
        assertThat(OrderStatus.PENDING_PAYMENT.countsAsRevenue()).isFalse();
    }
}
