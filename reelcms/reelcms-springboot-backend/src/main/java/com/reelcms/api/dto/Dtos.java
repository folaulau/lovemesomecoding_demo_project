package com.reelcms.api.dto;

import com.reelcms.api.entity.reel.ReelStatus;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;

/**
 * Every DTO in the app, in one file.
 *
 * <p>Records, not classes: they are immutable, need no Lombok, and serialize exactly as declared.
 * Grouping them here rather than in twenty files is a readability choice for a tutorial codebase -
 * the whole API surface is one scroll.
 *
 * <p>The read DTOs deliberately mirror the document shape almost field for field. That is not
 * laziness: it means the JSON the Vue app already consumes from src/api/mock.js needs no
 * translation, and it keeps the tutorial's "here is the document, here is the response" comparison
 * honest. Where they DO diverge is the interesting part - UserDto has no password field, and
 * ReelDto flattens nothing that the UI does not flatten.
 */
public final class Dtos {

    private Dtos() {}

    /* ------------------------------------------------------------------ reels */

    public record VideoDto(String url, String posterUrl, int durationSeconds, int width, int height, long sizeBytes) {}

    public record CreatorRefDto(String id, String username, String displayName, String avatarUrl) {}

    public record StatsDto(long views, long likes, long comments, long shares) {}

    public record ReelDto(
            String id,
            String slug,
            String title,
            String description,
            ReelStatus status,
            Instant publishedAt,
            Instant scheduledFor,
            VideoDto video,
            CreatorRefDto creator,
            List<String> tags,
            List<String> collectionIds,
            StatsDto stats,
            Instant createdAt,
            Instant updatedAt) {}

    /** Cursor-paginated feed page. `nextCursor` is null when there is nothing more. */
    public record FeedDto(List<ReelDto> items, String nextCursor) {}

    /** Offset-paginated list, matching what the Vue PaginationBar expects. */
    public record PageDto<T>(List<T> content, int page, int size, long totalElements, int totalPages) {}

    /** Create/update payload. Validation lives here so controllers stay thin. */
    public record ReelRequest(
            @NotBlank @Size(max = 140) String title,
            @Size(max = 90) String slug,
            @Size(max = 800) String description,
            ReelStatus status,
            Instant scheduledFor,
            String creatorId,
            List<String> tags,
            List<String> collectionIds,
            VideoDto video) {}

    public record StatusRequest(ReelStatus status) {}

    public record LikeRequest(boolean liked) {}

    public record LikeResponse(long likes) {}

    public record ViewRequest(int watchSeconds) {}

    /* --------------------------------------------------------------- creators */

    public record CreatorDto(
            String id,
            String username,
            String displayName,
            String avatarUrl,
            String bio,
            long followerCount,
            Instant createdAt) {}

    /** The admin table needs two derived numbers the document does not carry. */
    public record CreatorAdminDto(
            String id,
            String username,
            String displayName,
            String avatarUrl,
            String bio,
            long followerCount,
            Instant createdAt,
            long reelCount,
            long totalViews) {}

    public record CreatorRequest(
            @NotBlank @Size(max = 60) String displayName,
            @NotBlank @Size(max = 40) String username,
            @Size(max = 280) String bio) {}

    public record CreatorProfileDto(CreatorDto creator, List<ReelDto> reels) {}

    /* --------------------------------------------------------------- comments */

    public record CommentDto(
            String id, String reelId, CreatorRefDto author, String body, long likes, Instant createdAt) {}

    public record CommentRequest(@NotBlank @Size(max = 500) String body) {}

    /* ------------------------------------------------------------ collections */

    public record CollectionDto(
            String id,
            String slug,
            String name,
            String description,
            String coverUrl,
            List<String> reelIds,
            Instant createdAt) {}

    public record CollectionRequest(
            @NotBlank @Size(max = 80) String name, @Size(max = 90) String slug, @Size(max = 300) String description) {}

    public record CollectionPageDto(CollectionDto collection, List<ReelDto> reels) {}

    /* ---------------------------------------------------------------- auth */

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {}

    /** No password field, by construction. A DTO that cannot leak a hash beats remembering not to. */
    public record UserDto(String id, String email, String displayName, List<String> roles, String creatorId) {}

    public record LoginResponse(String token, UserDto user) {}

    /* -------------------------------------------------------------- uploads */

    public record UploadResponse(String url, long sizeBytes, String contentType) {}

    /* -------------------------------------------------------------- reports */

    /** One point on the dashboard's 30-day chart. */
    public record DailyViewsDto(String date, long views, long completions) {}

    public record TopReelDto(
            String reelId,
            String slug,
            String title,
            String posterUrl,
            String creator,
            long views,
            long likes,
            double completionRate) {}

    public record TagEngagementDto(String tag, long reels, long views, long likes) {}

    public record StatusCountDto(ReelStatus status, long count) {}

    public record TotalsDto(
            long totalReels,
            long publishedReels,
            long totalViews,
            long totalLikes,
            long totalComments,
            long totalCreators,
            double avgCompletionRate,
            long viewsLast7Days,
            long viewsPrev7Days) {}

    public record ReportDto(
            List<DailyViewsDto> viewsOverTime,
            List<TopReelDto> topReels,
            List<TagEngagementDto> engagementByTag,
            TotalsDto totals,
            List<StatusCountDto> statusBreakdown) {}

    /** One frame of the change-stream SSE feed. */
    public record StatsEventDto(String reelId, String slug, String title, long views, long delta) {}
}
