package com.pizza.api.entity.product;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Data-access contract for products.
 *
 * <p><b>Why a DAO on top of a Spring Data repository?</b> The repository is a framework type: its
 * method names are a query DSL, and swapping the persistence technology would change every caller.
 * The DAO is a plain interface expressed in this application's language, so services depend on our
 * vocabulary rather than on Spring Data's.
 *
 * <p>Everything is keyed by the public UUID. Nothing above this layer ever sees the numeric id.
 */
public interface ProductDAO {

    /** Every active product, pizzas first, in display order. */
    List<Product> findActiveMenu();

    /** Active products of one type only. */
    List<Product> findActiveByType(ProductType type);

    /** Everything, active or not — the admin catalogue view. */
    List<Product> getAll();

    Optional<Product> findByPublicId(UUID publicId);

    /** Loads a product together with its sizes, avoiding a lazy-loading failure outside a session. */
    Optional<Product> findByPublicIdWithSizes(UUID publicId);

    boolean existsByName(String name);

    Product save(Product product);
}
