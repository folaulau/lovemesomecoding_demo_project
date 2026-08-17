package com.pizza.api.entity.product;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/**
 * Spring Data generates the implementation of this interface at runtime — there is no
 * ProductRepositoryImpl to write.
 *
 * <p>Note the lookups are by {@code publicId}, not {@code id}. The numeric key never leaves the
 * server; the UUID is what arrives on a request. The unique index on public_id makes this exactly
 * as cheap as a primary-key lookup.
 */
public interface ProductRepository extends JpaRepository<Product, Long> {

    /**
     * {@code @EntityGraph} fetches the sizes in the SAME query. Without it, listing 14 products
     * triggers 1 query for the products plus 14 more for their sizes — the N+1 problem.
     */
    @EntityGraph(attributePaths = "sizes")
    List<Product> findByTypeAndActiveTrueOrderByDisplayOrderAsc(ProductType type);

    @EntityGraph(attributePaths = "sizes")
    List<Product> findByActiveTrueOrderByTypeAscDisplayOrderAsc();

    @EntityGraph(attributePaths = "sizes")
    @Query("select p from Product p")
    List<Product> findAllWithSizes();

    @EntityGraph(attributePaths = "sizes")
    Optional<Product> findWithSizesByPublicId(UUID publicId);

    Optional<Product> findByPublicId(UUID publicId);

    boolean existsByNameIgnoreCase(String name);
}
