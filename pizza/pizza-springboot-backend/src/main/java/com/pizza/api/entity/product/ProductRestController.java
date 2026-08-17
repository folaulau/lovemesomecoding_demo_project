package com.pizza.api.entity.product;

import static org.springframework.http.HttpStatus.CREATED;
import static org.springframework.http.HttpStatus.OK;

import com.pizza.api.dto.ProductCreateDTO;
import com.pizza.api.dto.ProductDTO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Public menu browsing. */
@Tag(name = "Products", description = "Menu browsing (public)")
@RequestMapping("/api/products")
@RestController
@Slf4j
public class ProductRestController {

    @Autowired
    private ProductService productService;

    @Operation(summary = "List the active menu, optionally filtered by type")
    @GetMapping
    public ResponseEntity<List<ProductDTO>> getProducts(@RequestParam(required = false) ProductType type) {
        log.info("GET /api/products type={}", type);
        List<ProductDTO> products = type == null ? productService.getMenu() : productService.getByType(type);
        return new ResponseEntity<>(products, OK);
    }

    @Operation(summary = "Get one product with its sizes")
    @GetMapping("/{id}")
    public ResponseEntity<ProductDTO> getProduct(@PathVariable UUID id) {
        log.info("GET /api/products/{}", id);
        return new ResponseEntity<>(productService.getProductByPublicId(id), OK);
    }
}

/**
 * Admin endpoints live on a separate path so the security rules can be expressed as a single
 * {@code /api/admin/**} matcher instead of per-method annotations that are easy to forget.
 */
@Tag(name = "Admin · Products", description = "Menu management (ADMIN only)")
@RequestMapping("/api/admin/products")
@RestController
@SecurityRequirement(name = "bearerAuth")
@Slf4j
class AdminProductRestController {

    @Autowired
    private ProductService productService;

    @Operation(summary = "List every product, including inactive ones")
    @GetMapping
    public ResponseEntity<List<ProductDTO>> getAllProducts() {
        log.info("GET /api/admin/products");
        return new ResponseEntity<>(productService.getAllProducts(), OK);
    }

    @Operation(summary = "Create a product")
    @PostMapping
    public ResponseEntity<ProductDTO> createProduct(@Valid @RequestBody ProductCreateDTO dto) {
        log.info("POST /api/admin/products name={}", dto.name());
        return new ResponseEntity<>(productService.createProduct(dto), CREATED);
    }

    @Operation(summary = "Update a product and replace its sizes")
    @PutMapping("/{id}")
    public ResponseEntity<ProductDTO> updateProduct(@PathVariable UUID id, @Valid @RequestBody ProductCreateDTO dto) {
        log.info("PUT /api/admin/products/{}", id);
        return new ResponseEntity<>(productService.updateProduct(id, dto), OK);
    }

    @Operation(summary = "Deactivate a product — hidden from the menu, still editable here")
    @PatchMapping("/{id}/deactivate")
    public ResponseEntity<Void> deactivateProduct(@PathVariable UUID id) {
        log.info("PATCH /api/admin/products/{}/deactivate", id);
        productService.deactivateProduct(id);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Soft-delete a product — past orders still reference it")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteProduct(@PathVariable UUID id) {
        log.info("DELETE /api/admin/products/{}", id);
        productService.deleteProduct(id);
        return ResponseEntity.noContent().build();
    }
}
