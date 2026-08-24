package com.reelcms.api.entity.reel;

import java.text.Normalizer;
import java.util.Locale;
import java.util.function.Predicate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * Turns a title into a URL segment.
 *
 * <p>Mirrors slugify() in the frontend's utils/format.js, so the slug previewed in the editor is
 * the slug that gets saved. If the two ever diverge, the user watches their URL change on save.
 */
@Service
public class SlugService {

    private static final int MAX_LENGTH = 70;

    public String slugify(String input) {
        if (!StringUtils.hasText(input)) {
            return "";
        }
        // NFD splits accented characters into base + combining mark, so the mark can be
        // stripped and "café" becomes "cafe" rather than "caf".
        String normalized = Normalizer.normalize(input, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9\\s-]", "")
                .trim()
                .replaceAll("\\s+", "-")
                .replaceAll("-+", "-");
        return normalized.length() > MAX_LENGTH ? normalized.substring(0, MAX_LENGTH) : normalized;
    }

    /**
     * Appends -2, -3 ... until the slug is free.
     *
     * <p>This is a convenience, not the safety net. Two simultaneous creates can both pass the
     * check and then collide, which is exactly why the slug index is declared unique - the database
     * constraint is what actually guarantees it, and this only keeps the common case tidy.
     */
    public String uniqueSlug(String desired, Predicate<String> exists) {
        String base = StringUtils.hasText(desired) ? desired : "reel";
        String candidate = base;
        int suffix = 2;
        while (exists.test(candidate)) {
            candidate = base + "-" + suffix++;
        }
        return candidate;
    }
}
