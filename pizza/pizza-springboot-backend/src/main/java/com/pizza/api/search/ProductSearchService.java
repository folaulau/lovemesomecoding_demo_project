package com.pizza.api.search;

import com.pizza.api.dto.ProductDTO;
import java.util.List;

/** Full-text menu search. */
public interface ProductSearchService {

    /** True when the search profile is active and an index is available. */
    boolean isEnabled();

    /** Reindexes every active product. Safe to re-run. */
    long reindexAll();

    /** Free-text search across product names and descriptions. */
    List<ProductDTO> search(String term);
}
