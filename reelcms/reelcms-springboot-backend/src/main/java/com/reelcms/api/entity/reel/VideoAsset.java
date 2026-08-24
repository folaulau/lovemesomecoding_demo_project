package com.reelcms.api.entity.reel;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * The media attached to a reel.
 *
 * <p>EMBEDDED, not referenced. It is 1:1 with the reel and no query ever wants a video without the
 * reel it belongs to, so a separate collection would buy a join and nothing else. This is the
 * easiest embed/reference call in the whole model - see Comment for the hardest.
 *
 * <p>Note there is no @Document annotation: a class only used as a nested field is mapped as a
 * sub-document automatically.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VideoAsset {

    /** Null until an upload completes. The UI falls back to the poster. */
    private String url;

    private String posterUrl;
    private int durationSeconds;
    private int width;
    private int height;
    private long sizeBytes;
}
