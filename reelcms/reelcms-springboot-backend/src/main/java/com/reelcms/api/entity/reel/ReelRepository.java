package com.reelcms.api.entity.reel;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

/**
 * Derived queries only. Anything that aggregates, does a cursor scan, or needs a partial update
 * lives in ReelDAOImp against MongoTemplate - the same split as the pizza backend uses between
 * Spring Data and JdbcTemplate.
 */
public interface ReelRepository extends MongoRepository<Reel, String> {

    Optional<Reel> findBySlug(String slug);

    boolean existsBySlug(String slug);

    /**
     * The public feed, page one. Served entirely by the {status, publishedAt} compound index -
     * equality on status, then a descending walk of publishedAt, with no in-memory sort.
     */
    List<Reel> findByStatusOrderByPublishedAtDesc(ReelStatus status, Pageable pageable);

    /**
     * The feed, page two onwards. This is the CURSOR form, and it is the reason the feed stays fast
     * at any depth: `skip(4000)` makes the server walk and throw away 4000 documents, while this
     * seeks straight into the index at the last publishedAt seen. Same index, constant cost.
     */
    List<Reel> findByStatusAndPublishedAtLessThanOrderByPublishedAtDesc(
            ReelStatus status, Instant before, Pageable pageable);

    List<Reel> findByCreatorIdAndStatusOrderByPublishedAtDesc(String creatorId, ReelStatus status);

    List<Reel> findByStatusAndScheduledForLessThanEqual(ReelStatus status, Instant now);

    List<Reel> findByIdInAndStatus(List<String> ids, ReelStatus status);

    long countByStatus(ReelStatus status);
}
