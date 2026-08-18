package com.pizza.api.search;

import com.pizza.api.dto.EntityDTOMapper;
import com.pizza.api.dto.ProductDTO;
import com.pizza.api.entity.product.Product;
import com.pizza.api.entity.product.ProductDAO;
import com.pizza.api.entity.product.ProductSize;
import java.math.BigDecimal;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Menu search backed by Elasticsearch.
 *
 * <p>{@code @Profile("search")} — without it there is no {@link ProductSearchRepository} bean and
 * this class could not be constructed. The controller therefore injects it through an
 * {@code ObjectProvider} and falls back to a database search, so the feature degrades rather than
 * disappears.
 *
 * <h2>The hard part is not the search, it is staying in step</h2>
 *
 * <p>Elasticsearch is a second copy of data that MySQL owns. Every write that changes a product has
 * to reach the index too, and there is no transaction spanning both — so the index is
 * <b>eventually</b> consistent at best, and permanently wrong if a reindex is ever skipped.
 *
 * <p>The three ways to keep them in step, worst to best:
 *
 * <ol>
 *   <li><b>Index inside the write transaction.</b> Simple, and wrong: the write now fails when
 *       Elasticsearch is down, and a rollback cannot un-index.
 *   <li><b>Index after commit</b> (an {@code AFTER_COMMIT} listener, as this app does for email).
 *       Good, but a crash between commit and index loses the update silently.
 *   <li><b>Rebuild periodically as well</b> — a scheduled full reindex that repairs whatever the
 *       incremental path missed. Belt and braces, and the only version that self-heals.
 * </ol>
 *
 * <p>{@link #reindexAll()} is that repair path. It is exposed as an admin endpoint rather than run
 * on a timer here, so the demo does not hammer a node nobody is watching.
 */
@Slf4j
@Service
@Profile("search")
@RequiredArgsConstructor
public class ProductSearchServiceImpl implements ProductSearchService {

    private final ProductSearchRepository searchRepository;
    private final ProductDAO productDAO;
    private final EntityDTOMapper mapper;

    @Override
    public boolean isEnabled() {
        return true;
    }

    @Override
    @Transactional(readOnly = true)
    public long reindexAll() {
        List<Product> products = productDAO.getAll();

        List<ProductDocument> documents = products.stream()
                .map(product -> ProductDocument.from(product, cheapestSize(product)))
                .toList();

        // saveAll is a bulk request, not N round trips. Indexing one document per HTTP call is the
        // classic reason a reindex takes twenty minutes instead of twenty seconds.
        searchRepository.saveAll(documents);

        log.info("Reindexed {} products", documents.size());
        return documents.size();
    }

    @Override
    public List<ProductDTO> search(String term) {
        if (term == null || term.isBlank()) {
            return List.of();
        }

        List<ProductDocument> hits = searchRepository.search(term.trim());

        // The index holds a denormalised copy, which is right for matching and ranking but is NOT
        // the source of truth for price or availability. Read the ids from Elasticsearch, then load
        // the real rows from MySQL — so a stale document can affect the ORDER of results but never
        // the prices a customer is shown.
        Map<String, Integer> rank = new HashMap<>();
        for (int i = 0; i < hits.size(); i++) {
            rank.put(hits.get(i).getId(), i);
        }

        return hits.stream()
                .map(hit -> productDAO.findByPublicIdWithSizes(UUID.fromString(hit.getId())))
                .flatMap(Optional::stream)
                .filter(Product::isActive)
                .sorted(Comparator.comparingInt(
                        p -> rank.getOrDefault(String.valueOf(p.getPublicId()), Integer.MAX_VALUE)))
                .map(mapper::mapProductToProductDTO)
                .toList();
    }

    private BigDecimal cheapestSize(Product product) {
        return product.getSizes().stream()
                .map(ProductSize::getPrice)
                .filter(Objects::nonNull)
                .min(Comparator.naturalOrder())
                .orElse(BigDecimal.ZERO);
    }
}
