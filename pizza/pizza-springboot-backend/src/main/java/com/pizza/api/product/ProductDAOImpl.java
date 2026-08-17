package com.pizza.api.product;

import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

/**
 * Delegates to {@link ProductRepository}.
 *
 * <p>{@code @RequiredArgsConstructor} (Lombok) generates a constructor taking every final field,
 * and Spring injects through it. Constructor injection over {@code @Autowired} on fields: the
 * dependencies are visible, and the object cannot be built in a half-initialised state.
 */
@Repository
@RequiredArgsConstructor
public class ProductDAOImpl implements ProductDAO {

    private final ProductRepository productRepository;

    @Override
    public List<Product> findActiveMenu() {
        return productRepository.findByActiveTrueOrderByTypeAscDisplayOrderAsc();
    }

    @Override
    public List<Product> findActiveByType(ProductType type) {
        return productRepository.findByTypeAndActiveTrueOrderByDisplayOrderAsc(type);
    }

    @Override
    public List<Product> findAll() {
        return productRepository.findAllWithSizes();
    }

    @Override
    public Optional<Product> findById(Long id) {
        return productRepository.findById(id);
    }

    @Override
    public Optional<Product> findByIdWithSizes(Long id) {
        return productRepository.findWithSizesById(id);
    }

    @Override
    public boolean existsByName(String name) {
        return productRepository.existsByNameIgnoreCase(name);
    }

    @Override
    public Product save(Product product) {
        return productRepository.save(product);
    }

    @Override
    public void deleteById(Long id) {
        productRepository.deleteById(id);
    }
}
