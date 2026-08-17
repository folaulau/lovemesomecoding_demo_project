package com.pizza.api.entity.product;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

/** Delegates to {@link ProductRepository}. */
@Slf4j
@Repository
public class ProductDAOImp implements ProductDAO {

    @Autowired
    private ProductRepository productRepository;

    @Override
    public List<Product> findActiveMenu() {
        return productRepository.findByActiveTrueOrderByTypeAscDisplayOrderAsc();
    }

    @Override
    public List<Product> findActiveByType(ProductType type) {
        return productRepository.findByTypeAndActiveTrueOrderByDisplayOrderAsc(type);
    }

    @Override
    public List<Product> getAll() {
        return productRepository.findAllWithSizes();
    }

    @Override
    public Optional<Product> findByPublicId(UUID publicId) {
        return productRepository.findByPublicId(publicId);
    }

    @Override
    public Optional<Product> findByPublicIdWithSizes(UUID publicId) {
        return productRepository.findWithSizesByPublicId(publicId);
    }

    @Override
    public boolean existsByName(String name) {
        return productRepository.existsByNameIgnoreCase(name);
    }

    @Override
    public Product save(Product product) {
        return productRepository.saveAndFlush(product);
    }
}
