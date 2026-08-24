package com.reelcms.api.entity.reel;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Engagement counters, embedded in the reel and moved with $inc.
 *
 * <p>$inc on a single document is atomic without a transaction - two concurrent views cannot lose
 * an increment the way a read-modify-write would. That is a real advantage over the relational
 * shape, where the equivalent needs either a row lock or an UPDATE ... SET views = views + 1.
 *
 * <p>These are a READ MODEL, derived from the view_events collection. Counting 30 million events on
 * every feed render is not viable, so the events are kept for analytics and the counter is kept for
 * display. Keeping both is the honest production shape.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReelStats {

    @Builder.Default
    private long views = 0;

    @Builder.Default
    private long likes = 0;

    @Builder.Default
    private long comments = 0;

    @Builder.Default
    private long shares = 0;
}
