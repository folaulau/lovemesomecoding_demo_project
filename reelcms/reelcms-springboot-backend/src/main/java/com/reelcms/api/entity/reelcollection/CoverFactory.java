package com.reelcms.api.entity.reelcollection;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/** A deterministic gradient cover as an inline SVG data URI, so no cover upload is required. */
public final class CoverFactory {

    private CoverFactory() {}

    private static final String[][] PAIRS = {
        {"#f97316", "#e0397f"},
        {"#10b981", "#0ea5e9"},
        {"#ef4444", "#f59e0b"},
        {"#7c3aed", "#2563eb"},
    };

    public static String forName(String name) {
        String label = name == null ? "Collection" : name.trim();
        String[] pair = PAIRS[Math.floorMod(label.hashCode(), PAIRS.length)];

        String svg = ("<svg xmlns='http://www.w3.org/2000/svg' width='1080' height='1920' viewBox='0 0 1080 1920'>"
                        + "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>"
                        + "<stop offset='0%%' stop-color='%s'/><stop offset='100%%' stop-color='%s'/>"
                        + "</linearGradient></defs>"
                        + "<rect width='1080' height='1920' fill='url(#g)'/>"
                        + "<circle cx='880' cy='300' r='240' fill='rgba(255,255,255,0.08)'/>"
                        + "<text x='540' y='980' text-anchor='middle' font-family='Inter, system-ui, sans-serif' "
                        + "font-size='84' font-weight='800' fill='rgba(255,255,255,0.96)'>%s</text></svg>")
                .formatted(pair[0], pair[1], escape(label));

        return "data:image/svg+xml;charset=utf-8,"
                + URLEncoder.encode(svg, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private static String escape(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
