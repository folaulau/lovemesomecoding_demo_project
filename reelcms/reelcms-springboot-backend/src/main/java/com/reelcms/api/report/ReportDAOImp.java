package com.reelcms.api.report;

import static org.springframework.data.mongodb.core.aggregation.Aggregation.*;

import com.reelcms.api.dto.Dtos.DailyViewsDto;
import com.reelcms.api.dto.Dtos.TagEngagementDto;
import com.reelcms.api.dto.Dtos.TopReelDto;
import com.reelcms.api.entity.reel.ReelStatus;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Repository;

/**
 * The aggregation pipelines behind the dashboard.
 *
 * <p>The stages that Spring Data's fluent builder covers well are written with it. The ones that
 * need operators it has no method for are written as raw JSON with {@link
 * org.springframework.data.mongodb.core.aggregation.Aggregation#stage(String)} - which is worth
 * knowing about, because the alternative is nested {@code new Document(...)} calls that nobody can
 * read and that reject nulls in surprising places. A stage written this way is copy-pasteable
 * straight into mongosh, which is exactly how you debug one.
 */
@Repository
@RequiredArgsConstructor
public class ReportDAOImp implements ReportDAO {

    private final MongoTemplate mongo;

    /** A view counts as a completion once 90% of the reel has been watched. */
    private static final double COMPLETION_THRESHOLD = 0.9;

    /**
     * Views per day, with a real completion count.
     *
     * <p>$dateTrunc rather than the older $dateToString idiom: it keeps the grouping key a genuine
     * date, so the $sort that follows is chronological rather than lexicographic and nothing
     * downstream has to re-parse a string.
     *
     * <p>The $lookup is what makes "completion" mean something - completion is a fraction of the
     * reel's length, and the length lives on the reel, not the event. $max guards the divisor
     * against a zero duration; dividing by zero in an aggregation does not throw, it yields null,
     * which then silently poisons every accumulator downstream.
     *
     * <p>Note the stage order. The $match on ts comes FIRST so the time-series collection can skip
     * whole buckets, and only the surviving events are joined. Putting the $lookup first would join
     * every event ever recorded and then throw most of them away.
     */
    @Override
    public List<DailyViewsDto> viewsOverTime(Instant from) {
        // Lower bound only. An upper bound of "now" is stamped before the counters
        // are read further up the call, so any view arriving in between is counted
        // by stats.views and excluded from this chart - a permanent off-by-a-few
        // between two figures on the same screen, worse the busier the site is.
        var agg = newAggregation(
                match(Criteria.where("ts").gte(Date.from(from))),
                lookup("reels", "metadata.reelId", "_id", "reel"),
                unwind("reel", false),
                stage(
                        """
                        { $group: {
                            _id: { $dateTrunc: { date: "$ts", unit: "day" } },
                            views: { $sum: 1 },
                            completions: { $sum: { $cond: [
                                { $gte: [
                                    { $divide: [ "$watchSeconds",
                                                 { $max: [ "$reel.video.durationSeconds", 1 ] } ] },
                                    %s ] },
                                1, 0 ] } }
                        } }
                        """
                                .formatted(COMPLETION_THRESHOLD)),
                sort(Sort.Direction.ASC, "_id"));

        List<DailyViewsDto> out = new ArrayList<>();
        for (Document doc : mongo.aggregate(agg, "view_events", Document.class).getMappedResults()) {
            Date day = doc.getDate("_id");
            out.add(new DailyViewsDto(
                    day.toInstant().toString().substring(0, 10),
                    number(doc.get("views")),
                    number(doc.get("completions"))));
        }
        return out;
    }

    /**
     * The most-watched reels in the window.
     *
     * <p>$group over the events gives ids and counts; $lookup then joins the reel documents back
     * in. Note the direction and the order: aggregate the BIG collection down to ten rows first,
     * and only then join the small one. A $lookup before the $limit would join every event.
     */
    @Override
    public List<TopReelDto> topReels(Instant from, int limit) {
        var agg = newAggregation(
                match(Criteria.where("ts").gte(Date.from(from))),
                group("metadata.reelId").count().as("views").avg("watchSeconds").as("avgWatch"),
                sort(Sort.Direction.DESC, "views"),
                limit(limit),
                // localField is _id because that is where $group put the grouping key -
                // it is not renamed back to reelId.
                lookup("reels", "_id", "_id", "reel"),
                unwind("reel", false));

        List<TopReelDto> out = new ArrayList<>();
        for (Document doc : mongo.aggregate(agg, "view_events", Document.class).getMappedResults()) {
            Document reel = doc.get("reel", Document.class);
            if (reel == null) {
                continue; // deleted reel whose events are still inside the window
            }
            Document video = reel.get("video", Document.class);
            Document creator = reel.get("creator", Document.class);
            Document stats = reel.get("stats", Document.class);

            int duration =
                    video == null ? 0 : number(video.get("durationSeconds")).intValue();
            double avgWatch = doc.get("avgWatch") instanceof Number n ? n.doubleValue() : 0;

            out.add(new TopReelDto(
                    // $group put metadata.reelId in _id, and that field is an ObjectId
                    // now - getString() would quietly return null.
                    String.valueOf(doc.get("_id")),
                    reel.getString("slug"),
                    reel.getString("title"),
                    video == null ? null : video.getString("posterUrl"),
                    creator == null ? "" : creator.getString("displayName"),
                    number(doc.get("views")),
                    stats == null ? 0 : number(stats.get("likes")),
                    duration == 0 ? 0 : Math.min(1.0, avgWatch / duration)));
        }
        return out;
    }

    /**
     * Views and likes per tag.
     *
     * <p>$unwind is what makes a group-by over an array field possible at all: it emits one
     * document per array element, so a reel tagged with three things becomes three rows and each
     * tag can be grouped independently.
     */
    @Override
    public List<TagEngagementDto> engagementByTag(int limit) {
        var agg = newAggregation(
                match(Criteria.where("status").is(ReelStatus.PUBLISHED)),
                unwind("tags"),
                group("tags")
                        .count()
                        .as("reels")
                        .sum("stats.views")
                        .as("views")
                        .sum("stats.likes")
                        .as("likes"),
                sort(Sort.Direction.DESC, "views"),
                limit(limit));

        List<TagEngagementDto> out = new ArrayList<>();
        for (Document doc : mongo.aggregate(agg, "reels", Document.class).getMappedResults()) {
            out.add(new TagEngagementDto(
                    doc.getString("_id"),
                    number(doc.get("reels")),
                    number(doc.get("views")),
                    number(doc.get("likes"))));
        }
        return out;
    }

    /** Mean fraction of each reel actually watched, capped at 1 so a re-watch cannot exceed 100%. */
    @Override
    public double averageCompletionRate(Instant from) {
        var agg = newAggregation(
                match(Criteria.where("ts").gte(Date.from(from))),
                lookup("reels", "metadata.reelId", "_id", "reel"),
                unwind("reel", false),
                stage(
                        """
                        { $group: {
                            _id: null,
                            rate: { $avg: { $min: [ 1, { $divide: [
                                "$watchSeconds",
                                { $max: [ "$reel.video.durationSeconds", 1 ] } ] } ] } }
                        } }
                        """));

        var results = mongo.aggregate(agg, "view_events", Document.class).getMappedResults();
        if (results.isEmpty() || !(results.get(0).get("rate") instanceof Number rate)) {
            return 0;
        }
        return rate.doubleValue();
    }

    @Override
    public long viewsBetween(Instant from, Instant to) {
        var agg =
                newAggregation(match(Criteria.where("ts").gte(Date.from(from)).lt(Date.from(to))), count().as("total"));
        var results = mongo.aggregate(agg, "view_events", Document.class).getMappedResults();
        return results.isEmpty() ? 0 : number(results.get(0).get("total"));
    }

    /**
     * $sum and $count return an Integer for small totals and a Long once they grow, so casting
     * straight to Long throws ClassCastException only after the data gets big - which is the worst
     * possible time to discover it.
     */
    private static Long number(Object value) {
        return value instanceof Number n ? n.longValue() : 0L;
    }
}
