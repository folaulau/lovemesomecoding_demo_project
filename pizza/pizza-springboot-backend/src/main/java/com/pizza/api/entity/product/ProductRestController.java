package com.pizza.api.entity.product;

import static org.springframework.http.HttpStatus.CREATED;
import static org.springframework.http.HttpStatus.OK;

import com.pizza.api.dto.ProductCreateDTO;
import com.pizza.api.dto.ProductDTO;
import com.pizza.api.storage.ProductImageStorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

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

    @Autowired
    private ProductImageStorageService imageStorage;

    /**
     * Streams a stored image back.
     *
     * <p>Returning {@code Resource} rather than {@code byte[]} is the point: Spring streams it,
     * so a 2 MB image never has to sit in heap in its entirety. With {@code byte[]} the whole file
     * is buffered per concurrent request, which is fine until it isn't.
     *
     * <p>{@code inline} rather than {@code attachment} in the disposition header — this is an image
     * to render on the menu, not a download. Getting that backwards makes every product photo
     * trigger a save dialog.
     */
    @Operation(summary = "Fetch a product image")
    @GetMapping("/images/{fileName}")
    public ResponseEntity<Resource> getImage(@PathVariable String fileName) {
        Resource image = imageStorage.load(fileName);

        MediaType contentType = fileName.toLowerCase().endsWith(".png")
                ? MediaType.IMAGE_PNG
                : fileName.toLowerCase().endsWith(".gif") ? MediaType.IMAGE_GIF : MediaType.IMAGE_JPEG;

        return ResponseEntity.ok()
                .contentType(contentType)
                // The name contains a UUID, so the bytes behind a given URL never change and it is
                // safe to cache hard.
                .cacheControl(
                        CacheControl.maxAge(java.time.Duration.ofDays(365)).cachePublic())
                .header("Content-Disposition", "inline; filename=\"" + fileName + "\"")
                .body(image);
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

    /**
     * Uploads a product image.
     *
     * <p>Three things make this a multipart endpoint rather than a normal one:
     *
     * <ul>
     *   <li>{@code consumes = MULTIPART_FORM_DATA_VALUE} — without it the request is matched
     *       against the JSON handlers and rejected as an unsupported media type.
     *   <li>{@code @RequestPart} (not {@code @RequestBody}) binds ONE named part of the body.
     *   <li>The part name — {@code "file"} — must match what the client puts in its FormData. A
     *       mismatch is a 400 that names the missing part, which is at least an honest error.
     * </ul>
     *
     * <p>The upload is a separate call from creating the product on purpose. Mixing a file and a
     * JSON body into one multipart request works, but it costs you Bean Validation on the JSON
     * half and makes the endpoint awkward to call from anything but a browser form.
     */
    @Operation(summary = "Upload an image for a product")
    @PostMapping(value = "/{id}/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ProductDTO> uploadImage(@PathVariable UUID id, @RequestPart("file") MultipartFile file) {
        log.info("POST /api/admin/products/{}/image ({} bytes)", id, file.getSize());
        return new ResponseEntity<>(productService.setProductImage(id, file), OK);
    }
}
