package com.reelcms.api.entity.reel;

import com.reelcms.api.dto.Dtos.PageDto;
import com.reelcms.api.dto.Dtos.ReelDto;
import com.reelcms.api.dto.Dtos.ReelRequest;
import com.reelcms.api.dto.Dtos.StatusRequest;
import com.reelcms.api.security.AuthPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin · Reels")
@RestController
@RequestMapping("/api/admin/reels")
@RequiredArgsConstructor
public class AdminReelRestController {

    private final ReelService reelService;

    @Operation(summary = "Filtered, paged list of every reel")
    @GetMapping
    public PageDto<ReelDto> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) ReelStatus status,
            @RequestParam(required = false) String creatorId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        return reelService.adminSearch(q, status, creatorId, page, size);
    }

    @Operation(summary = "One reel by id, whatever its status")
    @GetMapping("/{id}")
    public ReelDto byId(@PathVariable String id) {
        return reelService.adminById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ReelDto create(@Valid @RequestBody ReelRequest request, @AuthenticationPrincipal AuthPrincipal actor) {
        return reelService.create(request, actor);
    }

    @PutMapping("/{id}")
    public ReelDto update(
            @PathVariable String id,
            @Valid @RequestBody ReelRequest request,
            @AuthenticationPrincipal AuthPrincipal actor) {
        return reelService.update(id, request, actor);
    }

    @Operation(summary = "Publish, unpublish or archive")
    @PatchMapping("/{id}/status")
    public ReelDto setStatus(
            @PathVariable String id, @RequestBody StatusRequest request, @AuthenticationPrincipal AuthPrincipal actor) {
        return reelService.setStatus(id, request, actor);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id, @AuthenticationPrincipal AuthPrincipal actor) {
        reelService.delete(id, actor);
    }
}
