package com.pizza.api.product;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/**
 * Spring Data generates the implementation of this interface at runtime — there is no
 * ProductRepositoryImpl to write.
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
    Optional<Product> findWithSizesById(Long id);

    boolean existsByNameIgnoreCase(String name);
}
