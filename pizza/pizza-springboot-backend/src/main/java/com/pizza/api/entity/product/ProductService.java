package com.pizza.api.entity.product;

import com.pizza.api.dto.ProductCreateDTO;
import com.pizza.api.dto.ProductDTO;
import java.util.List;
import java.util.UUID;

public interface ProductService {

    List<ProductDTO> getMenu();

    List<ProductDTO> getByType(ProductType type);

    /** Admin view — includes inactive products. */
    List<ProductDTO> getAllProducts();

    ProductDTO getProductByPublicId(UUID id);

    ProductDTO createProduct(ProductCreateDTO dto);

    ProductDTO updateProduct(UUID id, ProductCreateDTO dto);

    /** Soft delete: old orders still reference the product, so the row must survive. */
    void deactivateProduct(UUID id);

    /** Marks the row deleted. @SQLRestriction then hides it from every query. */
    void deleteProduct(UUID id);
}
