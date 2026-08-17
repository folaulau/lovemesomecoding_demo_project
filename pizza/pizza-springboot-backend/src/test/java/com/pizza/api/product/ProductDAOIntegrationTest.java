package com.pizza.api.product;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * Exercises the product data-access layer against the real MySQL schema and its seed data.
 *
 * <p>{@code @Transactional} on a test rolls the transaction back when the test finishes, so these
 * can write freely without leaving anything behind.
 */
@SpringBootTest
@Transactional
@DisplayName("ProductDAO")
class ProductDAOIntegrationTest {

    @Autowired
    private ProductDAO productDAO;

    @Test
    @DisplayName("returns the seeded menu with pizzas and drinks")
    void findsActiveMenu() {
        List<Product> menu = productDAO.findActiveMenu();

        assertThat(menu).hasSize(14);
        assertThat(menu).extracting(Product::getType).containsOnly(ProductType.PIZZA, ProductType.DRINK);
        assertThat(menu).allSatisfy(p -> assertThat(p.getActive()).isTrue());
    }

    @Test
    @DisplayName("filters by type")
    void findsByType() {
        assertThat(productDAO.findActiveByType(ProductType.PIZZA)).hasSize(8);
        assertThat(productDAO.findActiveByType(ProductType.DRINK)).hasSize(6);
    }

    @Test
    @DisplayName("loads sizes eagerly via the entity graph, so no lazy access blows up")
    void loadsSizesWithProduct() {
        List<Product> pizzas = productDAO.findActiveByType(ProductType.PIZZA);

        assertThat(pizzas).allSatisfy(p -> assertThat(p.getSizes()).hasSize(3));
    }

    @Test
    @DisplayName("prices a known product per size")
    void pricesBySize() {
        Product pepperoni = productDAO.findActiveByType(ProductType.PIZZA).stream()
                .filter(p -> p.getName().equals("Pepperoni Pizza"))
                .findFirst()
                .orElseThrow();

        assertThat(pepperoni.priceFor(SizeName.SMALL)).contains(new BigDecimal("10.99"));
        assertThat(pepperoni.priceFor(SizeName.MEDIUM)).contains(new BigDecimal("13.99"));
        assertThat(pepperoni.priceFor(SizeName.LARGE)).contains(new BigDecimal("16.99"));
    }

    @Test
    @DisplayName("saving a product cascades its sizes")
    void savesProductWithSizes() {
        Product product = Product.builder()
                .name("Test Pizza " + System.nanoTime())
                .description("Created by a test")
                .type(ProductType.PIZZA)
                .active(true)
                .displayOrder(99)
                .build();
        product.addSize(ProductSize.builder()
                .size(SizeName.SMALL)
                .price(new BigDecimal("8.99"))
                .build());

        Product saved = productDAO.save(product);

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getSizes()).hasSize(1);
        assertThat(saved.getSizes().getFirst().getId()).isNotNull();
        // @PrePersist filled this in
        assertThat(saved.getCreatedAt()).isNotNull();
    }

    @Test
    @DisplayName("name lookup is case-insensitive")
    void checksNameExistence() {
        assertThat(productDAO.existsByName("pepperoni pizza")).isTrue();
        assertThat(productDAO.existsByName("Nonexistent Pizza")).isFalse();
    }
}
