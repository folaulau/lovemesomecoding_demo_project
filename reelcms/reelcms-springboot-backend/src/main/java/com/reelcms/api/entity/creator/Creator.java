package com.reelcms.api.entity.creator;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * The canonical creator profile.
 *
 * <p>Reels carry a CreatorRef snapshot of three of these fields. This document owns the truth; the
 * snapshot is a cache. followerCount is deliberately NOT in the snapshot - it changes far too often
 * to be worth fanning out.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "creators")
public class Creator {

    @Id
    private String id;

    /** Unique index. Used as the profile permalink, so it is slugified on write. */
    private String username;

    private String displayName;
    private String avatarUrl;
    private String bio;

    @Builder.Default
    private long followerCount = 0;

    @CreatedDate
    private Instant createdAt;
}
