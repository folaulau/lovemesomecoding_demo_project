package com.pizza.api.search;

import java.util.List;
import org.springframework.data.elasticsearch.annotations.Query;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;

/**
 * Spring Data repository over the {@code products} index.
 *
 * <p>The derived-query style is the same one Spring Data JPA uses — the method name is parsed into
 * a query — which is the point: the programming model transfers, only the store changes.
 *
 * <p>⚠️ This interface is only registered when {@code spring.data.elasticsearch.repositories.enabled}
 * is true. It is false by default (see {@code application.properties}), so that a machine without
 * Elasticsearch can still start the app.
 */
public interface ProductSearchRepository extends ElasticsearchRepository<ProductDocument, String> {

    /** Derived query: matches the analysed name field, filtered to active products. */
    List<ProductDocument> findByNameAndActiveTrue(String name);

    /**
     * When a derived name stops being able to express the query, drop to the real thing.
     *
     * <p>This is a {@code multi_match}: one set of terms tried against several fields, with
     * {@code name} boosted so a match in the title outranks a match buried in the description.
     * That relevance ranking is precisely what a SQL {@code LIKE '%term%'} cannot give you — LIKE
     * can tell you whether a row matched, never how well.
     */
    @Query(
            """
            {
              "bool": {
                "must": [
                  { "multi_match": { "query": "?0", "fields": ["name^3", "description"], "fuzziness": "AUTO" } }
                ],
                "filter": [ { "term": { "active": true } } ]
              }
            }
            """)
    List<ProductDocument> search(String term);
}
