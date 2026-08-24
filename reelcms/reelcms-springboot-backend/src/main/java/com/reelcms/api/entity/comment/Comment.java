package com.reelcms.api.entity.comment;

import com.reelcms.api.entity.reel.CreatorRef;
import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

/**
 * A comment on a reel - and the single most important modelling lesson in this app.
 *
 * <p>THIS IS ITS OWN COLLECTION, NOT AN ARRAY ON THE REEL. The instinct with a document database is
 * to embed the comments inside the reel that owns them, and for a small blog that is right. Here it
 * is wrong, for three reasons that all bite at different scales:
 *
 * <ol>
 *   <li>UNBOUNDED GROWTH. A document is capped at 16 MB. A reel that goes viral collects hundreds
 *       of thousands of comments and eventually the write simply fails - at the worst possible
 *       moment, on your most successful piece of content.
 *   <li>READ AMPLIFICATION. Every feed query would drag the entire comment thread along with each
 *       reel, to render a page that shows none of them. Projection can hide that, but the document
 *       still has to be read off disk.
 *   <li>WRITE CONTENTION. Appending to an array rewrites the document. The reel's own stats are
 *       being $inc'd on every view at the same time.
 * </ol>
 *
 * <p>The rule: EMBED WHAT IS BOUNDED, REFERENCE WHAT GROWS. Tags are bounded (a handful, forever).
 * Comments are not.
 *
 * <p>Note that the author IS embedded as a snapshot, for the same reason the reel embeds its
 * creator: the thread renders with no join.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "comments")
public class Comment {

    @Id
    private String id;

    /**
     * The reference back to the owning reel. Indexed with createdAt for the thread query.
     *
     * <p>Stored as an ObjectId rather than a string so it is the same type as the {@code _id} it
     * points at - see ViewEvent.ViewMetadata for why that matters the moment anything joins on it.
     * Spring Data converts transparently, so queries still take a plain String.
     */
    @Field(targetType = FieldType.OBJECT_ID)
    private String reelId;

    private CreatorRef author;

    private String body;

    @Builder.Default
    private long likes = 0;

    @CreatedDate
    private Instant createdAt;
}
