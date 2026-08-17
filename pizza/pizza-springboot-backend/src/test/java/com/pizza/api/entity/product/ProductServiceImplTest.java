package com.pizza.api.entity.product;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.pizza.api.dto.ProductCreateDTO;
import com.pizza.api.dto.ProductDTO;
import com.pizza.api.exception.ApiException;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/** Product CRUD, with particular attention to how sizes are reconciled on update. */
@SpringBootTest
@Transactional
@DisplayName("ProductService")
class ProductServiceImplTest {

    @Autowired
    private ProductService productService;

    private ProductCreateDTO dto(String name, double small, double medium, double large) {
        return new ProductCreateDTO(
                name,
                "created by a test",
                ProductType.PIZZA,
                null,
                true,
                50,
                List.of(
                        new ProductCreateDTO.SizeDTO(SizeName.SMALL, BigDecimal.valueOf(small)),
                        new ProductCreateDTO.SizeDTO(SizeName.MEDIUM, BigDecimal.valueOf(medium)),
                        new ProductCreateDTO.SizeDTO(SizeName.LARGE, BigDecimal.valueOf(large))));
    }

    private ProductCreateDTO create() {
        return dto("Service Test Pizza " + System.nanoTime(), 7.99, 9.99, 11.99);
    }

    @Test
    @DisplayName("creates a product with a generated UUID and three sizes")
    void createsProduct() {
        ProductDTO created = productService.createProduct(create());

        assertThat(created.id()).isNotNull();
        assertThat(created.sizes()).hasSize(3);
        assertThat(created.sizes()).allSatisfy(s -> assertThat(s.id()).isNotNull());
        assertThat(created.createdAt()).isNotNull();
    }

    /**
     * The regression this class exists for.
     *
     * <p>Updating used to clear the sizes and re-add them, which made Hibernate schedule the
     * INSERTs before the DELETEs in one flush and blow up with
     * {@code Duplicate entry '42-SMALL' for key 'uk_product_size'}. Every product edit returned a
     * 500.
     */
    @Test
    @DisplayName("updates prices in place without a unique-constraint violation")
    void updatesPricesInPlace() {
        ProductDTO created = productService.createProduct(create());

        ProductDTO updated =
                productService.updateProduct(created.id(), dto(created.name() + " edited", 8.49, 10.49, 12.49));

        assertThat(updated.name()).endsWith(" edited");
        assertThat(updated.sizes()).hasSize(3);
        assertThat(updated.sizes())
                .extracting(s -> s.price().doubleValue())
                .containsExactlyInAnyOrder(8.49, 10.49, 12.49);
    }

    /**
     * The second reason for merging rather than recreating: size rows now carry a public UUID that
     * clients can hold. Delete-and-recreate would mint new ones, so editing a price would silently
     * invalidate identifiers already handed out.
     */
    @Test
    @DisplayName("keeps each size's public UUID across an update")
    void preservesSizeUuids() {
        ProductDTO created = productService.createProduct(create());
        List<UUID> before = created.sizes().stream().map(s -> s.id()).sorted().toList();

        ProductDTO updated = productService.updateProduct(created.id(), dto(created.name(), 8.49, 10.49, 12.49));
        List<UUID> after = updated.sizes().stream().map(s -> s.id()).sorted().toList();

        assertThat(after).isEqualTo(before);
    }

    @Test
    @DisplayName("drops a size that is no longer requested")
    void dropsRemovedSize() {
        ProductDTO created = productService.createProduct(create());

        ProductCreateDTO twoSizes = new ProductCreateDTO(
                created.name(),
                "now only two sizes",
                ProductType.PIZZA,
                null,
                true,
                50,
                List.of(
                        new ProductCreateDTO.SizeDTO(SizeName.SMALL, new BigDecimal("8.49")),
                        new ProductCreateDTO.SizeDTO(SizeName.MEDIUM, new BigDecimal("10.49"))));

        ProductDTO updated = productService.updateProduct(created.id(), twoSizes);

        assertThat(updated.sizes()).hasSize(2);
        assertThat(updated.sizes())
                .extracting(s -> s.size())
                .containsExactlyInAnyOrder(SizeName.SMALL, SizeName.MEDIUM);
    }

    @Test
    @DisplayName("rejects a duplicate name")
    void rejectsDuplicateName() {
        assertThatThrownBy(() -> productService.createProduct(dto("Pepperoni Pizza", 1, 2, 3)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("already exists");
    }

    @Test
    @DisplayName("rejects the same size listed twice")
    void rejectsDuplicateSize() {
        ProductCreateDTO bad = new ProductCreateDTO(
                "Dupe Size Pizza " + System.nanoTime(),
                "x",
                ProductType.PIZZA,
                null,
                true,
                0,
                List.of(
                        new ProductCreateDTO.SizeDTO(SizeName.SMALL, new BigDecimal("5.00")),
                        new ProductCreateDTO.SizeDTO(SizeName.SMALL, new BigDecimal("6.00"))));

        assertThatThrownBy(() -> productService.createProduct(bad))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Duplicate size");
    }

    @Test
    @DisplayName("deactivating hides a product from the public menu but keeps it for admins")
    void deactivateHidesFromMenu() {
        ProductDTO created = productService.createProduct(create());
        assertThat(productService.getMenu()).anySatisfy(p -> assertThat(p.id()).isEqualTo(created.id()));

        productService.deactivateProduct(created.id());

        assertThat(productService.getMenu()).noneSatisfy(p -> assertThat(p.id()).isEqualTo(created.id()));
        assertThat(productService.getAllProducts())
                .anySatisfy(p -> assertThat(p.id()).isEqualTo(created.id()));
    }

    @Test
    @DisplayName("soft delete removes it from the admin list too — @SQLRestriction filters it out")
    void softDeleteHidesEverywhere() {
        ProductDTO created = productService.createProduct(create());

        productService.deleteProduct(created.id());

        assertThat(productService.getMenu()).noneSatisfy(p -> assertThat(p.id()).isEqualTo(created.id()));
        assertThat(productService.getAllProducts())
                .noneSatisfy(p -> assertThat(p.id()).isEqualTo(created.id()));
    }

    @Test
    @DisplayName("an unknown UUID is a 404-shaped ApiException")
    void unknownIdNotFound() {
        UUID unknown = UUID.fromString("00000000-0000-4000-8000-000000000000");

        assertThatThrownBy(() -> productService.getProductByPublicId(unknown))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("was not found");
    }
}
