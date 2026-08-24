package com.reelcms.api.entity.viewevent;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;
import org.springframework.data.mongodb.core.mapping.TimeSeries;
import org.springframework.data.mongodb.core.timeseries.Granularity;

/**
 * One playback event. The raw material every dashboard number is aggregated from.
 *
 * <p>This is a TIME-SERIES COLLECTION, which is a different storage engine, not just a naming
 * convention. Mongo buckets documents that share a metaField over a window of time and stores the
 * measurements column-wise, which for append-only telemetry is dramatically smaller on disk and
 * faster to scan by time range than a normal collection with an index on a date field.
 *
 * <p>Two constraints come with that and both are easy to trip over:
 *
 * <ol>
 *   <li>The collection MUST be created with the time-series options BEFORE any insert. Spring Data
 *       does this from @TimeSeries only when auto-index-creation / collection creation runs, which
 *       is why MongoIndexConfig creates it explicitly at startup instead of trusting the mapping.
 *       Insert into a plain collection of the same name first and you get an ordinary collection
 *       that silently works and quietly costs ten times the disk.
 *   <li>Documents in a time-series collection CANNOT BE UPDATED OR DELETED individually (before
 *       Mongo 8, not at all; since then only in narrow cases). That is fine here - a view event is
 *       a fact, and facts are not edited. Expiry is handled by a TTL on the whole bucket.
 * </ol>
 *
 * <p>Everything queried alongside the timestamp goes in metadata, because that is the field the
 * bucketing key is built from. Putting reelId at the top level instead would still work and would
 * quietly lose most of the benefit.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "view_events")
@TimeSeries(collection = "view_events", timeField = "ts", metaField = "metadata", granularity = Granularity.SECONDS)
public class ViewEvent {

    @Id
    private String id;

    /** The time field. Named "ts" to match the collection options exactly. */
    private Instant ts;

    private ViewMetadata metadata;

    /** How much of the reel was actually watched. Drives the completion-rate report. */
    private int watchSeconds;

    /**
     * The bucketing key. Everything the reports filter or group by belongs in here.
     *
     * <p>NOTE @Field(targetType = OBJECT_ID) ON THE TWO REFERENCES. This is the single most
     * common way to lose an afternoon with $lookup in Spring Data MongoDB.
     *
     * <p>A field declared {@code String id} is stored as a BSON string. But the {@code @Id} of
     * the document it points at is stored as a BSON ObjectId, because Spring Data converts
     * 24-character hex ids on the way in. $lookup compares localField to foreignField with
     * STRICT TYPE EQUALITY - an ObjectId never equals a string, even when they print
     * identically. The join silently matches nothing, $unwind then drops every row, and the
     * report comes back as an empty array with no error anywhere to explain it.
     *
     * <p>targetType tells the mapper to store these as ObjectIds while keeping them Strings in
     * Java, so the join works and the code stays readable. The alternative is converting inside
     * the pipeline with {@code $toObjectId}, which works but pays the cost on every query
     * instead of once at write time.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ViewMetadata {

        @Field(targetType = FieldType.OBJECT_ID)
        private String reelId;

        @Field(targetType = FieldType.OBJECT_ID)
        private String creatorId;

        private String country;
        private String device;
    }
}
