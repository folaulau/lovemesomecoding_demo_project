package com.reelcms.api.security;

import static org.assertj.core.api.Assertions.assertThat;

import com.reelcms.api.entity.user.User;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class JwtServiceTest {

    private static final String SECRET = "a-test-secret-that-is-definitely-long-enough-for-hs256";

    private final JwtService service = new JwtService(SECRET, 12);

    private User user() {
        return User.builder()
                .id("507f1f77bcf86cd799439011")
                .email("admin@reelcms.test")
                .roles(List.of("ADMIN"))
                .creatorId("507f191e810c19729de860ea")
                .build();
    }

    @Test
    void roundTripsTheClaims() {
        var claims = service.parse(service.issue(user()));

        assertThat(claims).isNotNull();
        assertThat(claims.getSubject()).isEqualTo("507f1f77bcf86cd799439011");
        assertThat(claims.get("email", String.class)).isEqualTo("admin@reelcms.test");
        assertThat(claims.get("creatorId", String.class)).isEqualTo("507f191e810c19729de860ea");
        assertThat(service.rolesOf(claims)).containsExactly("ADMIN");
    }

    @Test
    @DisplayName("a token signed with another key is rejected, not trusted")
    void rejectsAForeignSignature() {
        String foreign = new JwtService("a-completely-different-secret-also-long-enough-ok", 12).issue(user());
        assertThat(service.parse(foreign)).isNull();
    }

    @Test
    @DisplayName("an expired token is rejected")
    void rejectsExpired() {
        String expired = new JwtService(SECRET, 0).issue(user());
        assertThat(service.parse(expired)).isNull();
    }

    @Test
    @DisplayName("garbage returns null instead of throwing")
    void rejectsGarbage() {
        // Callers treat an invalid token as "not signed in", so this must be a
        // return value rather than an exception on the filter's hot path.
        assertThat(service.parse("not-a-jwt")).isNull();
        assertThat(service.parse("")).isNull();
    }

    @Test
    void rolesOfIsEmptyWhenTheClaimIsMissing() {
        var claims = service.parse(
                service.issue(User.builder().id("x").email("a@b.c").build()));
        assertThat(service.rolesOf(claims)).isEmpty();
    }
}
