package com.reelcms.api.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AuthPrincipalTest {

    private static final String CREATOR_A = "507f191e810c19729de860ea";
    private static final String CREATOR_B = "507f191e810c19729de860eb";

    @Test
    void adminIsRecognised() {
        var admin = new AuthPrincipal("u1", "admin@x.test", List.of("ADMIN"), null);
        assertThat(admin.isAdmin()).isTrue();
        assertThat(admin.ownsCreator(CREATOR_A)).isFalse();
    }

    @Test
    @DisplayName("a creator owns only their own profile")
    void creatorOwnership() {
        var creator = new AuthPrincipal("u2", "c@x.test", List.of("CREATOR"), CREATOR_A);
        assertThat(creator.isAdmin()).isFalse();
        assertThat(creator.ownsCreator(CREATOR_A)).isTrue();
        assertThat(creator.ownsCreator(CREATOR_B)).isFalse();
    }

    @Test
    @DisplayName("a null creatorId never matches - including against another null")
    void nullCreatorIdOwnsNothing() {
        // Guarding this explicitly matters: null.equals(null) would otherwise make
        // every admin the owner of every reel that has no creator.
        var admin = new AuthPrincipal("u1", "admin@x.test", List.of("ADMIN"), null);
        assertThat(admin.ownsCreator(null)).isFalse();
    }
}
