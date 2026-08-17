package com.pizza.api.product;

import java.util.List;
import java.util.Optional;

/**
 * Data-access contract for products.
 *
 * <p><b>Why a DAO on top of a Spring Data repository?</b> The repository is a framework type: its
 * method names are a query DSL, and swapping the persistence technology would change every caller.
 * The DAO is a plain interface expressed in this application's language ({@code findMenu},
 * {@code findPizzas}), so services depend on our vocabulary rather than on Spring Data's.
 *
 * <p>In a small app this is arguably a layer too many, and calling the repository straight from the
 * service is a perfectly defensible choice. It is used here because the project brief asks for this
 * layout, and because it gives a natural home for query logic that spans several repositories.
 */
public interface ProductDAO {

    /** Every active product, pizzas first, in display order. */
    List<Product> findActiveMenu();

    /** Active products of one type only. */
    List<Product> findActiveByType(ProductType type);

    /** Everything, active or not — the admin catalogue view. */
    List<Product> findAll();

    Optional<Product> findById(Long id);

    /** Loads a product together with its sizes, avoiding a lazy-loading failure outside a session. */
    Optional<Product> findByIdWithSizes(Long id);

    boolean existsByName(String name);

    Product save(Product product);

    void deleteById(Long id);
}
