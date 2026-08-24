package com.reelcms.api.config;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * The one way this application asks for the current time.
 *
 * <p>BSON STORES DATES AT MILLISECOND PRECISION. {@code Instant.now()} on a modern JVM carries
 * microseconds, so stamping a field with it and saving produces an object whose in-memory value and
 * whose stored value are different:
 *
 * <pre>
 *   in memory : 2026-08-24T18:53:07.048898Z
 *   in mongo  : 2026-08-24T18:53:07.048Z
 * </pre>
 *
 * <p>Nothing fails. The document saves, the read succeeds, and everything looks right - until
 * something compares the two. A POST response and a subsequent GET disagree on a timestamp; an
 * equality assertion in a test fails by 898 microseconds; a client caching on "did updatedAt
 * change?" re-fetches forever.
 *
 * <p>Truncating at the source means the value written and the value read back are always the same
 * one. Applies to auditing too - see MongoConfig, which routes @CreatedDate and @LastModifiedDate
 * through here.
 */
public final class Timestamps {

    private Timestamps() {}

    public static Instant now() {
        return Instant.now().truncatedTo(ChronoUnit.MILLIS);
    }

    /** Truncates a caller-supplied instant to the precision Mongo will actually keep. */
    public static Instant toStorage(Instant instant) {
        return instant == null ? null : instant.truncatedTo(ChronoUnit.MILLIS);
    }
}
