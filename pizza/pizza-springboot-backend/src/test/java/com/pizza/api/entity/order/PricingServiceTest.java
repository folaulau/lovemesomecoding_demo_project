package com.pizza.api.entity.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.pizza.api.TestIds;
import com.pizza.api.dto.OrderCreateDTO;
import com.pizza.api.entity.product.SizeName;
import com.pizza.api.exception.ApiException;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pricing is where the money is, so it gets the most direct tests.
 *
 * <p>Every expected figure below is written out by hand from the seeded menu prices — if the
 * implementation and the test ever agree on a wrong number, it will be because both were changed
 * deliberately.
 */
@SpringBootTest
@Transactional
@DisplayName("PricingService")
class PricingServiceTest {

    @Autowired
    private PricingService pricingService;

    private OrderCreateDTO requestWith(OrderType type, OrderCreateDTO.ItemDTO... items) {
        return new OrderCreateDTO(
                type,
                "Test Customer",
                "test@example.com",
                null,
                "1 Test St",
                null,
                "Salt Lake City",
                "UT",
                "84101",
                List.of(items));
    }

    @Test
    @DisplayName("prices a plain large pizza with delivery")
    void pricesSimpleOrder() {
        // Large Pepperoni = 16.99. Tax 16.99 * 0.085 = 1.44415 -> 1.44. Delivery 3.99.
        var priced = pricingService.price(requestWith(
                OrderType.DELIVERY,
                new OrderCreateDTO.ItemDTO(TestIds.PEPPERONI_PIZZA, SizeName.LARGE, null, null, 1)));

        assertThat(priced.subtotal()).isEqualByComparingTo("16.99");
        assertThat(priced.tax()).isEqualByComparingTo("1.44");
        assertThat(priced.deliveryFee()).isEqualByComparingTo("3.99");
        assertThat(priced.total()).isEqualByComparingTo("22.42");
    }

    @Test
    @DisplayName("adds the crust surcharge and every topping")
    void pricesCrustAndToppings() {
        // 16.99 base + 2.50 stuffed crust + 1.75 bacon + 1.75 extra cheese = 22.99
        var priced = pricingService.price(requestWith(
                OrderType.DELIVERY,
                new OrderCreateDTO.ItemDTO(
                        TestIds.PEPPERONI_PIZZA,
                        SizeName.LARGE,
                        TestIds.CRUST_STUFFED,
                        List.of(TestIds.TOPPING_BACON, TestIds.TOPPING_EXTRA_CHEESE),
                        1)));

        assertThat(priced.items()).hasSize(1);
        assertThat(priced.items().getFirst().getUnitPrice()).isEqualByComparingTo("22.99");
        assertThat(priced.subtotal()).isEqualByComparingTo("22.99");
        assertThat(priced.tax()).isEqualByComparingTo("1.95");
        assertThat(priced.total()).isEqualByComparingTo("28.93");
    }

    @Test
    @DisplayName("multiplies by quantity")
    void multipliesByQuantity() {
        var priced = pricingService.price(requestWith(
                OrderType.CARRYOUT,
                new OrderCreateDTO.ItemDTO(TestIds.PEPPERONI_PIZZA, SizeName.LARGE, null, null, 3)));

        assertThat(priced.items().getFirst().getLineTotal()).isEqualByComparingTo("50.97");
        assertThat(priced.subtotal()).isEqualByComparingTo("50.97");
    }

    @Test
    @DisplayName("charges no delivery fee for carryout")
    void noDeliveryFeeForCarryout() {
        var priced = pricingService.price(requestWith(
                OrderType.CARRYOUT,
                new OrderCreateDTO.ItemDTO(TestIds.PEPPERONI_PIZZA, SizeName.LARGE, null, null, 1)));

        assertThat(priced.deliveryFee()).isEqualByComparingTo("0.00");
        assertThat(priced.total()).isEqualByComparingTo("18.43");
    }

    @Test
    @DisplayName("sums several lines")
    void sumsMultipleLines() {
        // 16.99 large pepperoni + (2.99 large pepsi x 2 = 5.98) = 22.97
        var priced = pricingService.price(requestWith(
                OrderType.CARRYOUT,
                new OrderCreateDTO.ItemDTO(TestIds.PEPPERONI_PIZZA, SizeName.LARGE, null, null, 1),
                new OrderCreateDTO.ItemDTO(TestIds.PEPSI, SizeName.LARGE, null, null, 2)));

        assertThat(priced.subtotal()).isEqualByComparingTo("22.97");
    }

    @Test
    @DisplayName("snapshots the product and topping names onto the line")
    void snapshotsNames() {
        var priced = pricingService.price(requestWith(
                OrderType.CARRYOUT,
                new OrderCreateDTO.ItemDTO(
                        TestIds.PEPPERONI_PIZZA,
                        SizeName.LARGE,
                        TestIds.CRUST_STUFFED,
                        List.of(TestIds.TOPPING_BACON),
                        1)));

        OrderItem item = priced.items().getFirst();
        assertThat(item.getProductName()).isEqualTo("Pepperoni Pizza");
        assertThat(item.getCrustName()).isEqualTo("Stuffed Crust");
        assertThat(item.getToppings()).singleElement().satisfies(t -> {
            assertThat(t.getToppingName()).isEqualTo("Bacon");
            assertThat(t.getPrice()).isEqualByComparingTo("1.75");
        });
    }

    @Test
    @DisplayName("rejects an unknown product")
    void rejectsUnknownProduct() {
        assertThatThrownBy(() -> pricingService.price(requestWith(
                        OrderType.CARRYOUT,
                        new OrderCreateDTO.ItemDTO(TestIds.NONEXISTENT, SizeName.LARGE, null, null, 1))))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Unknown product");
    }

    @Test
    @DisplayName("rejects an unknown topping")
    void rejectsUnknownTopping() {
        assertThatThrownBy(() -> pricingService.price(requestWith(
                        OrderType.CARRYOUT,
                        new OrderCreateDTO.ItemDTO(
                                TestIds.PEPPERONI_PIZZA, SizeName.LARGE, null, List.of(TestIds.NONEXISTENT), 1))))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Unknown topping");
    }

    @Test
    @DisplayName("every monetary value comes back at exactly 2 decimal places")
    void alwaysTwoDecimalPlaces() {
        var priced = pricingService.price(requestWith(
                OrderType.DELIVERY,
                new OrderCreateDTO.ItemDTO(
                        TestIds.SUPREME_PIZZA,
                        SizeName.MEDIUM,
                        TestIds.CRUST_STUFFED,
                        List.of(TestIds.TOPPING_PEPPERONI, TestIds.TOPPING_MUSHROOMS, TestIds.TOPPING_PARMESAN),
                        2)));

        for (BigDecimal value : List.of(priced.subtotal(), priced.tax(), priced.deliveryFee(), priced.total())) {
            assertThat(value.scale()).isEqualTo(2);
        }
        // subtotal must equal the sum of the line totals, always.
        BigDecimal sumOfLines =
                priced.items().stream().map(OrderItem::getLineTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        assertThat(priced.subtotal()).isEqualByComparingTo(sumOfLines);
    }
}
