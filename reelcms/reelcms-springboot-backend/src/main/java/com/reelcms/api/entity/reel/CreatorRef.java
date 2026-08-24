package com.reelcms.api.entity.reel;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A denormalized snapshot of the creator, embedded in every reel.
 *
 * <p>This is the most consequential modelling decision in the app, so it is worth being explicit
 * about both halves of it:
 *
 * <p>WHAT IT BUYS: the public feed renders creator name and avatar with no $lookup. The feed is the
 * hottest query in the system and it stays a single index scan over one collection.
 *
 * <p>WHAT IT COSTS: these three fields are a COPY. When a creator is renamed, every reel they own
 * has to be rewritten - see CreatorServiceImpl#rename, which does exactly that with one
 * updateMulti. The id is the source of truth; the copy is a cache that we are responsible for
 * invalidating.
 *
 * <p>The rule of thumb: denormalize fields that are read constantly and change rarely. A display
 * name qualifies. A follower count would not - it changes every minute, and is deliberately NOT
 * copied here.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreatorRef {

    /** The reference. Everything else in this class is a cached copy. */
    private String id;

    private String username;
    private String displayName;
    private String avatarUrl;
}
