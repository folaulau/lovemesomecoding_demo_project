package com.reelcms.api.entity.creator;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/**
 * Generates a deterministic initials avatar as an inline SVG data URI.
 *
 * <p>No external avatar service, so the demo works with no network. The colour is derived from the
 * name's hash, which means the same creator always gets the same avatar without storing anything.
 */
public final class AvatarFactory {

    private AvatarFactory() {}

    private static final String[][] PAIRS = {
        {"#f97316", "#e0397f"},
        {"#10b981", "#0ea5e9"},
        {"#7c3aed", "#2563eb"},
        {"#ef4444", "#f59e0b"},
        {"#14b8a6", "#8b5cf6"},
        {"#e0397f", "#7c3aed"},
    };

    public static String forName(String displayName) {
        String name = displayName == null || displayName.isBlank() ? "?" : displayName.trim();
        String initials = initialsOf(name);
        String[] pair = PAIRS[Math.floorMod(name.hashCode(), PAIRS.length)];

        String svg = ("<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'>"
                        + "<defs><linearGradient id='a' x1='0' y1='0' x2='1' y2='1'>"
                        + "<stop offset='0%%' stop-color='%s'/><stop offset='100%%' stop-color='%s'/>"
                        + "</linearGradient></defs>"
                        + "<rect width='160' height='160' fill='url(#a)'/>"
                        + "<text x='80' y='104' text-anchor='middle' font-family='Inter, system-ui, sans-serif' "
                        + "font-size='66' font-weight='700' fill='rgba(255,255,255,0.95)'>%s</text></svg>")
                .formatted(pair[0], pair[1], escape(initials));

        return "data:image/svg+xml;charset=utf-8,"
                + URLEncoder.encode(svg, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private static String initialsOf(String name) {
        String[] words = name.split("\\s+");
        if (words.length >= 2) {
            return ("" + words[0].charAt(0) + words[1].charAt(0)).toUpperCase(Locale.ROOT);
        }
        return name.substring(0, Math.min(2, name.length())).toUpperCase(Locale.ROOT);
    }

    /** A raw ampersand makes the SVG malformed and the data URI silently fails to render. */
    private static String escape(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
