package com.reelcms.api.entity.reel;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ReelStatsTest {

    @Test
    @DisplayName("a new Reel has zeroed stats, not null ones")
    void defaultsAreZeroNotNull() {
        // @Builder.Default is what makes this true. Without it the builder leaves
        // the field null and every stats.views read NPEs on a freshly created reel.
        Reel reel = Reel.builder().title("x").build();

        assertThat(reel.getStats()).isNotNull();
        assertThat(reel.getStats().getViews()).isZero();
        assertThat(reel.getTags()).isNotNull().isEmpty();
        assertThat(reel.getCollectionIds()).isNotNull().isEmpty();
    }

    @Test
    void statsBuilderDefaultsToZero() {
        ReelStats stats = ReelStats.builder().build();

        assertThat(stats.getViews()).isZero();
        assertThat(stats.getLikes()).isZero();
        assertThat(stats.getComments()).isZero();
        assertThat(stats.getShares()).isZero();
    }
}
