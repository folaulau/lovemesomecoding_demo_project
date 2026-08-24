package com.reelcms.api.entity.creator;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AvatarFactoryTest {

    @Test
    void producesAnSvgDataUri() {
        assertThat(AvatarFactory.forName("Hoops Daily")).startsWith("data:image/svg+xml;charset=utf-8,");
    }

    @Test
    @DisplayName("two words become two initials, one word becomes two letters")
    void initials() {
        assertThat(decode(AvatarFactory.forName("Hoops Daily"))).contains(">HD<");
        assertThat(decode(AvatarFactory.forName("Pitchside"))).contains(">PI<");
    }

    @Test
    @DisplayName("the same name always gets the same avatar")
    void deterministic() {
        assertThat(AvatarFactory.forName("Gridiron Cut")).isEqualTo(AvatarFactory.forName("Gridiron Cut"));
    }

    @Test
    @DisplayName("an ampersand is escaped, so the SVG stays parseable")
    void escapesAmpersand() {
        // A raw & makes the SVG malformed and the browser renders alt text
        // instead - a bug that looks like a layout problem, not an encoding one.
        String decoded = decode(AvatarFactory.forName("Ben & Jerry"));
        assertThat(decoded).contains("&amp;").doesNotContain(">B&<");
    }

    @Test
    void handlesBlankNames() {
        assertThat(AvatarFactory.forName(null)).isNotBlank();
        assertThat(AvatarFactory.forName("  ")).isNotBlank();
    }

    private String decode(String dataUri) {
        return URLDecoder.decode(dataUri.substring(dataUri.indexOf(',') + 1), StandardCharsets.UTF_8);
    }
}
