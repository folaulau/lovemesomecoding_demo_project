package com.pizza.api.search;

import com.pizza.api.dto.EntityDTOMapper;
import com.pizza.api.dto.ProductDTO;
import com.pizza.api.entity.product.Product;
import com.pizza.api.entity.product.ProductDAO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Menu search, with a deliberate fallback.
 *
 * <p>{@link ProductSearchService} only exists under the {@code search} profile, so this controller
 * asks for it through an {@link ObjectProvider} and searches the database directly when it is
 * absent. The endpoint therefore always answers — better results with Elasticsearch, adequate ones
 * without — instead of 404ing on a machine that has no node running.
 *
 * <p>That fallback is also the honest comparison the tutorial needs. The database version is a
 * case-insensitive substring scan: it cannot rank, cannot handle a typo, and gets slower as the
 * catalogue grows. Everything Elasticsearch is FOR is visible in the difference between the two
 * branches below.
 */
@Slf4j
@Tag(name = "Search", description = "Menu search (public)")
@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
public class ProductSearchRestController {

    private final ObjectProvider<ProductSearchService> searchServiceProvider;
    private final ProductDAO productDAO;
    private final EntityDTOMapper mapper;

    @Operation(summary = "Search the menu by name or description")
    @GetMapping("/products")
    public ResponseEntity<List<ProductDTO>> search(@RequestParam("q") String term) {
        ProductSearchService searchService = searchServiceProvider.getIfAvailable();

        if (searchService != null) {
            log.info("GET /api/search/products?q={} (elasticsearch)", term);
            return ResponseEntity.ok(searchService.search(term));
        }

        log.info("GET /api/search/products?q={} (database fallback)", term);
        return ResponseEntity.ok(databaseSearch(term));
    }

    @Operation(summary = "Rebuild the search index")
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/reindex")
    public ResponseEntity<String> reindex() {
        ProductSearchService searchService = searchServiceProvider.getIfAvailable();
        if (searchService == null) {
            // 503, not 404: the endpoint exists, the capability behind it is switched off.
            return ResponseEntity.status(503).body("Search is not enabled — run with the 'search' profile");
        }
        long count = searchService.reindexAll();
        return ResponseEntity.ok("Reindexed " + count + " products");
    }

    /**
     * The fallback: everything a LIKE query can do, which is not much.
     *
     * <p>No relevance, no fuzziness, no stemming — "pepperoni" will not find "Pepperonis", and a
     * search for "chees" finds nothing at all.
     */
    private List<ProductDTO> databaseSearch(String term) {
        if (term == null || term.isBlank()) {
            return List.of();
        }
        String needle = term.trim().toLowerCase(Locale.ROOT);

        return productDAO.findActiveMenu().stream()
                .filter(product -> matches(product, needle))
                .map(mapper::mapProductToProductDTO)
                .toList();
    }

    private boolean matches(Product product, String needle) {
        String name = product.getName() == null ? "" : product.getName().toLowerCase(Locale.ROOT);
        String description =
                product.getDescription() == null ? "" : product.getDescription().toLowerCase(Locale.ROOT);
        return name.contains(needle) || description.contains(needle);
    }
}
