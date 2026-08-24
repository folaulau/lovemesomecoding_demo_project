package com.reelcms.api.entity.reel;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

/**
 * The aggregate root: one document per reel.
 *
 * <p>Read the four nested types alongside this one - VideoAsset, CreatorRef, ReelStats and the
 * separate Comment collection. Between them they cover every embed-vs-reference case worth knowing:
 *
 * <ul>
 *   <li>{@code video} EMBEDDED - 1:1, never read apart
 *   <li>{@code creator} REFERENCED + snapshotted - read constantly, changes rarely
 *   <li>{@code tags} EMBEDDED array - small, bounded, queried with a multikey index
 *   <li>{@code collectionIds} REFERENCED - many-to-many, and the other side is edited independently
 *   <li>{@code stats} EMBEDDED - atomic $inc counters
 *   <li>comments NOT here at all - unbounded growth, see the Comment class
 * </ul>
 *
 * <p>Indexes are declared in MongoIndexConfig rather than with @Indexed here. That is deliberate:
 * auto-index-creation is off in production for good reason (a stray annotation can trigger an index
 * build on a live collection), and having them in one file makes the whole index strategy readable
 * in one screen.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "reels")
public class Reel {

    @Id
    private String id;

    /** Public permalink segment. Unique index; see SlugService for collision handling. */
    private String slug;

    private String title;
    private String description;

    private ReelStatus status;

    /** Set once, when the reel first goes PUBLISHED. Null before that. */
    private Instant publishedAt;

    /** Only meaningful while status is SCHEDULED. */
    private Instant scheduledFor;

    private VideoAsset video;

    private CreatorRef creator;

    @Builder.Default
    private List<String> tags = new ArrayList<>();

    @Builder.Default
    private List<String> collectionIds = new ArrayList<>();

    @Builder.Default
    private ReelStats stats = ReelStats.builder().build();

    /**
     * Auditing fields. @CreatedDate / @LastModifiedDate only work because
     * MongoConfig enables @EnableMongoAuditing - without it these stay null and
     * nothing warns you.
     */
    @CreatedDate
    @Field("createdAt")
    private Instant createdAt;

    @LastModifiedDate
    @Field("updatedAt")
    private Instant updatedAt;
}
