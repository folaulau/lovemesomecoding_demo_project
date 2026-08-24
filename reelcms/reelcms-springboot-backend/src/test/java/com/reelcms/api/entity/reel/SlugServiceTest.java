package com.reelcms.api.entity.reel;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class SlugServiceTest {

    private final SlugService service = new SlugService();

    @ParameterizedTest
    @CsvSource({
        "'Fadeaway over two defenders','fadeaway-over-two-defenders'",
        "'  Leading and trailing  ','leading-and-trailing'",
        "'Multiple   inner   spaces','multiple-inner-spaces'",
        "'Punctuation! Does: it? work.','punctuation-does-it-work'",
        "'4th & Inches','4th-inches'",
        "'ALL CAPS','all-caps'",
        "'already-a-slug','already-a-slug'",
        "'--edge--dashes--','-edge-dashes-'",
    })
    void slugifies(String input, String expected) {
        assertThat(service.slugify(input)).isEqualTo(expected);
    }

    @Test
    @DisplayName("accents are folded to ASCII rather than dropped")
    void foldsAccents() {
        // NFD normalization is what makes this work; without it "café" loses the
        // final character entirely instead of becoming "cafe".
        assertThat(service.slugify("Café au lait")).isEqualTo("cafe-au-lait");
        assertThat(service.slugify("Nîmes Olympique")).isEqualTo("nimes-olympique");
    }

    @Test
    void emptyAndNullAreSafe() {
        assertThat(service.slugify(null)).isEmpty();
        assertThat(service.slugify("   ")).isEmpty();
        assertThat(service.slugify("!!!")).isEmpty();
    }

    @Test
    @DisplayName("a slug is capped at 70 characters")
    void capsLength() {
        String slug = service.slugify("word ".repeat(60));
        assertThat(slug).hasSizeLessThanOrEqualTo(70);
    }

    @Test
    @DisplayName("uniqueSlug appends a counter until the slug is free")
    void appendsCounter() {
        Set<String> taken = Set.of("buzzer-beater", "buzzer-beater-2", "buzzer-beater-3");
        assertThat(service.uniqueSlug("buzzer-beater", taken::contains)).isEqualTo("buzzer-beater-4");
    }

    @Test
    void uniqueSlugLeavesAFreeSlugAlone() {
        assertThat(service.uniqueSlug("free-slug", s -> false)).isEqualTo("free-slug");
    }

    @Test
    @DisplayName("a blank desired slug falls back to 'reel' rather than an empty URL")
    void blankFallsBack() {
        assertThat(service.uniqueSlug("", s -> false)).isEqualTo("reel");
    }
}
