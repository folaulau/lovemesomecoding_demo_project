package com.reelcms.api.entity.reel;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/**
 * The queries Spring Data cannot derive from a method name.
 *
 * <p>Same split as the pizza backend keeps between a repository and JdbcTemplate: the repository
 * handles save, findById and anything expressible as a derived query; this interface covers
 * everything that needs the query builder - dynamic filters, $text search with a relevance sort,
 * and partial updates that must not rewrite the whole document.
 */
public interface ReelDAO {

    /** Admin list with any combination of free-text, status and creator filters. */
    Page<Reel> search(String q, ReelStatus status, String creatorId, Pageable pageable);

    /** Public search over the text index, ordered by relevance score. */
    Page<Reel> textSearch(String q, String tag, Pageable pageable);

    /**
     * Atomically bump a counter. A partial update, not a save() - see the implementation for why
     * that distinction is the whole point.
     */
    void incrementStat(String reelId, String statField, long delta);

    /** Rewrites the denormalized creator snapshot on every reel a creator owns. */
    long refreshCreatorSnapshot(String creatorId, String username, String displayName, String avatarUrl);

    /** Removes a collection id from every reel referencing it. */
    long pullCollectionId(String collectionId);

    List<String> trendingTags(int limit);
}
