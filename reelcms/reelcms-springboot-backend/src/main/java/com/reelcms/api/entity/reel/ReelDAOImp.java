package com.reelcms.api.entity.reel;

import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.TextCriteria;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;

@Repository
@RequiredArgsConstructor
public class ReelDAOImp implements ReelDAO {

    private final MongoTemplate mongo;

    @Override
    public Page<Reel> search(String q, ReelStatus status, String creatorId, Pageable pageable) {
        Query query = new Query();

        if (status != null) {
            query.addCriteria(Criteria.where("status").is(status));
        }
        if (StringUtils.hasText(creatorId)) {
            query.addCriteria(Criteria.where("creator.id").is(creatorId));
        }
        if (StringUtils.hasText(q)) {
            // A regex, NOT the text index. Two reasons, both worth knowing:
            //
            //   1. A $text search cannot be combined with a sort by any other field -
            //      it always sorts by relevance - and the admin list sorts by updatedAt.
            //   2. $text only matches whole words, so typing "fade" would find nothing
            //      until you finished the word. An admin filter box has to match as you
            //      type.
            //
            // The trade-off is that a leading-wildcard regex cannot use an index and
            // scans the collection. Acceptable here (an admin list is thousands of
            // documents at most) and NOT acceptable on the public search, which is why
            // that path uses textSearch() below instead.
            String safe = java.util.regex.Pattern.quote(q.trim());
            query.addCriteria(new Criteria()
                    .orOperator(
                            Criteria.where("title").regex(safe, "i"),
                            Criteria.where("tags").regex(safe, "i"),
                            Criteria.where("creator.displayName").regex(safe, "i")));
        }

        // count() must run on a query WITHOUT the skip/limit, or the total is just the
        // page size. Cloning the criteria before applying the page is the safe order.
        long total = mongo.count(query, Reel.class);

        query.with(pageable.getSortOr(Sort.by(Sort.Direction.DESC, "updatedAt")));
        query.skip(pageable.getOffset()).limit(pageable.getPageSize());

        return new PageImpl<>(mongo.find(query, Reel.class), pageable, total);
    }

    @Override
    public Page<Reel> textSearch(String q, String tag, Pageable pageable) {
        Query query = new Query();
        query.addCriteria(Criteria.where("status").is(ReelStatus.PUBLISHED));

        if (StringUtils.hasText(tag)) {
            query.addCriteria(Criteria.where("tags").is(tag));
        }

        if (StringUtils.hasText(q)) {
            // The text index, with the field weights set in MongoIndexConfig deciding
            // the ranking. matchingAny() ORs the terms; matchingPhrase() would require
            // the exact sequence.
            query.addCriteria(
                    TextCriteria.forDefaultLanguage().matchingAny(q.trim().split("\\s+")));
            // Sorting by the score requires it to be projected first. Spring Data's
            // sortByScore() does both. Sorting on "score" by hand without the projection
            // yields an arbitrary order and no error.
            query.with(Sort.by(Sort.Direction.DESC, "score"));
            query = query.with(pageable.getSort().isSorted() ? pageable.getSort() : Sort.unsorted());
        } else {
            query.with(Sort.by(Sort.Direction.DESC, "publishedAt"));
        }

        long total = mongo.count(query, Reel.class);
        query.skip(pageable.getOffset()).limit(pageable.getPageSize());

        return new PageImpl<>(mongo.find(query, Reel.class), pageable, total);
    }

    @Override
    public void incrementStat(String reelId, String statField, long delta) {
        // $inc, not read-modify-write. This is the single most useful thing to take
        // away about counters in MongoDB:
        //
        //   findById -> stats.views++ -> save()   loses increments under concurrency,
        //                                         and rewrites the ENTIRE document
        //   $inc                                  is atomic at the document level and
        //                                         touches one field
        //
        // No transaction is needed because a single-document update is already atomic.
        mongo.updateFirst(
                Query.query(Criteria.where("_id").is(reelId)),
                new Update().inc("stats." + statField, delta),
                Reel.class);
    }

    @Override
    public long refreshCreatorSnapshot(String creatorId, String username, String displayName, String avatarUrl) {
        // The bill for denormalization, paid in one statement. updateMulti rewrites the
        // snapshot on every reel this creator owns.
        //
        // At demo scale this is instant. At a million reels per creator it is a
        // background job, and the fact that it is ONE call here rather than a loop is
        // what keeps that migration path open.
        var result = mongo.updateMulti(
                Query.query(Criteria.where("creator.id").is(creatorId)),
                new Update()
                        .set("creator.username", username)
                        .set("creator.displayName", displayName)
                        .set("creator.avatarUrl", avatarUrl),
                Reel.class);
        return result.getModifiedCount();
    }

    @Override
    public long pullCollectionId(String collectionId) {
        // $pull removes matching elements from an array in place - no read, no rewrite
        // of the other fields.
        var result = mongo.updateMulti(
                Query.query(Criteria.where("collectionIds").is(collectionId)),
                new Update().pull("collectionIds", collectionId),
                Reel.class);
        return result.getModifiedCount();
    }

    @Override
    public List<String> trendingTags(int limit) {
        // $unwind turns each reel into one document per tag, which is what makes a
        // group-by over an array field possible at all.
        var agg = Aggregation.newAggregation(
                Aggregation.match(Criteria.where("status").is(ReelStatus.PUBLISHED)),
                Aggregation.unwind("tags"),
                Aggregation.group("tags").sum("stats.views").as("views"),
                Aggregation.sort(Sort.Direction.DESC, "views"),
                Aggregation.limit(limit));

        var results = mongo.aggregate(agg, "reels", org.bson.Document.class).getMappedResults();
        List<String> tags = new ArrayList<>(results.size());
        for (var doc : results) {
            // $group puts the grouping key in _id, always - it is not renamed to "tags".
            tags.add(doc.getString("_id"));
        }
        return tags;
    }
}
