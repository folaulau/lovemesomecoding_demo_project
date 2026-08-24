package com.reelcms.api.entity.reel;

import com.reelcms.api.dto.Dtos.CommentDto;
import com.reelcms.api.dto.Dtos.CommentRequest;
import com.reelcms.api.dto.Dtos.FeedDto;
import com.reelcms.api.dto.Dtos.LikeRequest;
import com.reelcms.api.dto.Dtos.LikeResponse;
import com.reelcms.api.dto.Dtos.PageDto;
import com.reelcms.api.dto.Dtos.ReelDto;
import com.reelcms.api.dto.Dtos.ViewRequest;
import com.reelcms.api.entity.comment.CommentService;
import com.reelcms.api.entity.viewevent.ViewEventService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** The public read surface. No authentication anywhere in this controller. */
@Tag(name = "Public")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ReelRestController {

    private final ReelService reelService;
    private final CommentService commentService;
    private final ViewEventService viewEventService;

    @Operation(summary = "Cursor-paginated feed of published reels")
    @GetMapping("/feed")
    public FeedDto feed(@RequestParam(required = false) String cursor, @RequestParam(defaultValue = "6") int limit) {
        return reelService.feed(cursor, limit);
    }

    @Operation(summary = "Full-text search over published reels")
    @GetMapping("/reels")
    public PageDto<ReelDto> search(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String tag,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "12") int size) {
        return reelService.publicSearch(q, tag, page, size);
    }

    @Operation(summary = "One reel by its slug")
    @GetMapping("/reels/{slug}")
    public ReelDto bySlug(@PathVariable String slug) {
        return reelService.bySlug(slug);
    }

    @Operation(summary = "Most-viewed tags")
    @GetMapping("/tags/trending")
    public List<String> trendingTags() {
        return reelService.trendingTags();
    }

    @Operation(summary = "A reel's comment thread")
    @GetMapping("/reels/{id}/comments")
    public List<CommentDto> comments(@PathVariable String id) {
        return commentService.forReel(id);
    }

    @Operation(summary = "Post a comment")
    @PostMapping("/reels/{id}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public CommentDto addComment(@PathVariable String id, @Valid @RequestBody CommentRequest request) {
        return commentService.add(id, request.body());
    }

    @Operation(summary = "Like or unlike")
    @PostMapping("/reels/{id}/like")
    public LikeResponse like(@PathVariable String id, @RequestBody LikeRequest request) {
        return new LikeResponse(reelService.like(id, request.liked()));
    }

    @Operation(summary = "Record a playback")
    @PostMapping("/reels/{id}/views")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void recordView(
            @PathVariable String id,
            @RequestBody(required = false) ViewRequest request,
            HttpServletRequest httpRequest) {
        int watchSeconds = request == null ? 0 : request.watchSeconds();
        // Real geo-IP is out of scope for a demo; the field exists because the
        // time-series metaField is where a production version would put it.
        viewEventService.record(id, watchSeconds, "US", deviceOf(httpRequest));
    }

    private String deviceOf(HttpServletRequest request) {
        String ua = request.getHeader("User-Agent");
        if (ua == null) {
            return "unknown";
        }
        String lower = ua.toLowerCase();
        if (lower.contains("mobile") || lower.contains("android") || lower.contains("iphone")) {
            return "mobile";
        }
        return lower.contains("ipad") || lower.contains("tablet") ? "tablet" : "desktop";
    }
}
