package com.reelcms.api.exception;

import java.time.Instant;
import java.util.List;

/**
 * The error body every failure returns.
 *
 * <p>The field names are not arbitrary - src/api/http.js reads `message` and `subErrors`, so
 * renaming either silently degrades every error in the UI to "Request failed (400)".
 */
public record ApiError(int status, String error, String message, List<ApiSubError> subErrors, Instant timestamp) {

    public record ApiSubError(String field, Object rejectedValue, String message) {}
}
