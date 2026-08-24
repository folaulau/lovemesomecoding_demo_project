package com.reelcms.api.config;

import com.reelcms.api.entity.viewevent.ViewEvent;
import jakarta.annotation.PostConstruct;
import java.time.Duration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.CollectionOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.TextIndexDefinition;
import org.springframework.data.mongodb.core.timeseries.Granularity;
import org.springframework.stereotype.Component;

/**
 * Every index in the application, created once at startup.
 *
 * <p>Declared here rather than with @Indexed on the entities, for two reasons. First,
 * auto-index-creation is off by default in Spring Data MongoDB 4+ and should stay off: an
 * annotation that silently triggers an index build against a live multi-gigabyte collection is a
 * production incident waiting to happen. Second, an index strategy is only reviewable if you can
 * see it all at once, and scattering it across five entity classes guarantees nobody ever does.
 *
 * <p>THIS RUNS IN @PostConstruct, NOT ON ApplicationReadyEvent, and the difference is not
 * cosmetic. DataSeeder is an ApplicationRunner, and ApplicationRunner fires BEFORE
 * ApplicationReadyEvent. Create the indexes on the ready event and the seeder has already
 * inserted - which means MongoDB auto-created view_events as an ORDINARY collection, and the
 * time-series options below are then silently ignored because a collection cannot be converted
 * after the fact. Everything still works; it just costs an order of magnitude more disk, and
 * nothing anywhere says so. @PostConstruct runs during context refresh, before any runner.
 *
 * <p>THE ESR RULE governs the field order in every compound index below: Equality first, then Sort,
 * then Range. Get the order wrong and Mongo can still use the index, but it has to sort the results
 * in memory afterwards - which is capped at 32 MB and fails outright on a large result set. Check
 * any of these with .explain(): you want an IXSCAN with no SORT stage above it.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MongoIndexConfig {

    private final MongoTemplate mongo;

    /** How long raw view events are kept before Mongo expires them. */
    private static final Duration VIEW_EVENT_TTL = Duration.ofDays(90);

    @PostConstruct
    public void createIndexes() {
        createTimeSeriesCollection();

        var reels = mongo.indexOps("reels");

        // The public feed - the hottest query in the app. Equality on status, then a
        // descending walk of publishedAt. No in-memory sort at any depth.
        reels.createIndex(new Index().on("status", Sort.Direction.ASC).on("publishedAt", Sort.Direction.DESC));

        // A creator's own reels in the admin list. Two equality fields then the sort.
        reels.createIndex(new Index()
                .on("creator.id", Sort.Direction.ASC)
                .on("status", Sort.Direction.ASC)
                .on("publishedAt", Sort.Direction.DESC));

        // Permalinks. Unique, so it doubles as the slug-collision guard - SlugService
        // relies on this constraint existing rather than on a check-then-write race.
        reels.createIndex(new Index().on("slug", Sort.Direction.ASC).unique());

        // MULTIKEY: `tags` is an array, so Mongo indexes one entry per element. That is
        // automatic - there is no separate multikey index type - and it is why
        // {tags: "nba"} is an index seek rather than a scan.
        reels.createIndex(new Index().on("tags", Sort.Direction.ASC).on("publishedAt", Sort.Direction.DESC));

        // Full-text search. Weights decide ranking when a term hits several fields: a
        // match in the title outranks one in the description five to one.
        //
        // A collection may have AT MOST ONE text index, which is the single most
        // surprising limitation here. It can cover many fields (as this one does), but
        // you cannot add a second text index later for a different field set - the
        // create fails with IndexOptionsConflict.
        reels.createIndex(TextIndexDefinition.builder()
                .onField("title", 10F)
                .onField("tags", 8F)
                .onField("description", 5F)
                .build());

        // A reel's comment thread.
        mongo.indexOps("comments")
                .createIndex(new Index().on("reelId", Sort.Direction.ASC).on("createdAt", Sort.Direction.DESC));

        mongo.indexOps("creators")
                .createIndex(new Index().on("username", Sort.Direction.ASC).unique());

        mongo.indexOps("reel_collections")
                .createIndex(new Index().on("slug", Sort.Direction.ASC).unique());

        mongo.indexOps("users")
                .createIndex(new Index().on("email", Sort.Direction.ASC).unique());

        log.info("MongoDB indexes ensured");
    }

    /**
     * A time-series collection has to be CREATED with its options - it cannot be converted later.
     * If an ordinary collection called view_events already exists (because something inserted into
     * it before this ran), Mongo keeps it as-is and every write still succeeds, so the only symptom
     * is a collection that quietly costs an order of magnitude more disk than it should.
     */
    private void createTimeSeriesCollection() {
        if (mongo.collectionExists(ViewEvent.class)) {
            return;
        }
        // Spring Data MongoDB 5.x moved the fluent builders onto TimeSeriesOptions;
        // in 4.x they hung off CollectionOptions directly. This is the current form.
        mongo.createCollection(
                "view_events", CollectionOptions.timeSeries("ts", options -> options.metaField("metadata")
                        .granularity(Granularity.SECONDS)
                        // TTL on a time-series collection expires whole BUCKETS,
                        // not individual documents - which is why it belongs here
                        // at creation rather than on an @Indexed(expireAfter=...)
                        // field.
                        .expireAfter(VIEW_EVENT_TTL)));
        log.info("Created time-series collection view_events (TTL {} days)", VIEW_EVENT_TTL.toDays());
    }
}
