package com.pizza.api.entity.product;

import com.pizza.api.dto.EntityDTOMapper;
import com.pizza.api.dto.ProductCreateDTO;
import com.pizza.api.dto.ProductDTO;
import com.pizza.api.exception.ApiException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Slf4j
public class ProductServiceImpl implements ProductService {

    @Autowired
    private ProductDAO productDAO;

    @Autowired
    private EntityDTOMapper mapper;

    /**
     * {@code readOnly = true} lets Hibernate skip dirty checking and tells the driver this will not
     * write — cheaper, and it makes an accidental write fail loudly.
     */
    @Override
    @Transactional(readOnly = true)
    public List<ProductDTO> getMenu() {
        log.debug("Getting the active menu");
        return mapper.mapProductsToProductDTOs(productDAO.findActiveMenu());
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductDTO> getByType(ProductType type) {
        log.debug("Getting active products of type {}", type);
        return mapper.mapProductsToProductDTOs(productDAO.findActiveByType(type));
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductDTO> getAllProducts() {
        return mapper.mapProductsToProductDTOs(productDAO.getAll());
    }

    @Override
    @Transactional(readOnly = true)
    public ProductDTO getProductByPublicId(UUID id) {
        return productDAO
                .findByPublicIdWithSizes(id)
                .map(mapper::mapProductToProductDTO)
                .orElseThrow(() -> ApiException.notFound("Product", id));
    }

    @Override
    @Transactional
    public ProductDTO createProduct(ProductCreateDTO dto) {
        log.info("Creating product {}", dto.name());

        if (productDAO.existsByName(dto.name())) {
            throw ApiException.badRequest("A product named '" + dto.name() + "' already exists");
        }

        Product product = mapper.mapProductCreateDTOToProduct(dto);
        product.setActive(dto.active() == null || dto.active());
        product.setDisplayOrder(dto.displayOrder() == null ? 0 : dto.displayOrder());
        applySizes(product, dto);

        return mapper.mapProductToProductDTO(productDAO.save(product));
    }

    @Override
    @Transactional
    public ProductDTO updateProduct(UUID id, ProductCreateDTO dto) {
        log.info("Updating product {}", id);

        Product product =
                productDAO.findByPublicIdWithSizes(id).orElseThrow(() -> ApiException.notFound("Product", id));

        product.setName(dto.name());
        product.setDescription(dto.description());
        product.setType(dto.type());
        product.setImageUrl(dto.imageUrl());
        if (dto.active() != null) {
            product.setActive(dto.active());
        }
        if (dto.displayOrder() != null) {
            product.setDisplayOrder(dto.displayOrder());
        }

        mergeSizes(product, dto);

        return mapper.mapProductToProductDTO(productDAO.save(product));
    }

    @Override
    @Transactional
    public void deactivateProduct(UUID id) {
        log.info("Deactivating product {}", id);
        Product product = productDAO.findByPublicId(id).orElseThrow(() -> ApiException.notFound("Product", id));
        product.setActive(false);
        productDAO.save(product);
    }

    @Override
    @Transactional
    public void deleteProduct(UUID id) {
        log.info("Soft-deleting product {}", id);
        Product product = productDAO.findByPublicId(id).orElseThrow(() -> ApiException.notFound("Product", id));
        product.setDeleted(true);
        productDAO.save(product);
    }

    /** Create path: the product has no sizes yet, so every requested size is new. */
    private void applySizes(Product product, ProductCreateDTO dto) {
        for (ProductCreateDTO.SizeDTO sizeDTO : validated(dto)) {
            product.addSize(ProductSize.builder()
                    .size(sizeDTO.size())
                    .price(sizeDTO.price())
                    .build());
        }
    }

    /**
     * Update path: reconcile the existing rows in place rather than clearing and re-adding.
     *
     * <p>Two reasons, both of which bit for real:
     *
     * <ol>
     *   <li><b>It used to fail with a 500.</b> Clearing the collection and re-adding the same sizes
     *       made Hibernate schedule the INSERTs before the DELETEs in one flush, so the new rows
     *       collided with the old ones on the unique key:
     *       {@code Duplicate entry '42-SMALL' for key 'uk_product_size'}. Forcing a flush between
     *       the two would also work, but that just papers over needless churn.
     *   <li><b>It would change the public UUIDs.</b> Every size row now carries a {@code publicId}
     *       that clients can hold. Delete-and-recreate mints a brand new one, so merely editing a
     *       price would silently invalidate identifiers already handed out.
     * </ol>
     */
    private void mergeSizes(Product product, ProductCreateDTO dto) {
        List<ProductCreateDTO.SizeDTO> requested = validated(dto);

        // 1. update the sizes that already exist; add the ones that do not
        for (ProductCreateDTO.SizeDTO sizeDTO : requested) {
            product.getSizes().stream()
                    .filter(existing -> existing.getSize() == sizeDTO.size())
                    .findFirst()
                    .ifPresentOrElse(
                            existing -> existing.setPrice(sizeDTO.price()),
                            () -> product.addSize(ProductSize.builder()
                                    .size(sizeDTO.size())
                                    .price(sizeDTO.price())
                                    .build()));
        }

        // 2. drop any size no longer requested — orphanRemoval turns this into a DELETE
        List<SizeName> keep =
                requested.stream().map(ProductCreateDTO.SizeDTO::size).toList();
        product.getSizes().removeIf(existing -> !keep.contains(existing.getSize()));
    }

    /** A product cannot be sold twice in the same size. */
    private List<ProductCreateDTO.SizeDTO> validated(ProductCreateDTO dto) {
        List<SizeName> seen = new ArrayList<>();
        for (ProductCreateDTO.SizeDTO sizeDTO : dto.sizes()) {
            if (seen.contains(sizeDTO.size())) {
                throw ApiException.badRequest("Duplicate size: " + sizeDTO.size());
            }
            seen.add(sizeDTO.size());
        }
        return dto.sizes();
    }
}
