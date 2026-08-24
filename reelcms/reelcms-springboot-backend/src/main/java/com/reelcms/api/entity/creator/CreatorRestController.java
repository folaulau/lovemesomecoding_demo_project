package com.reelcms.api.entity.creator;

import com.reelcms.api.dto.Dtos.CreatorAdminDto;
import com.reelcms.api.dto.Dtos.CreatorProfileDto;
import com.reelcms.api.dto.Dtos.CreatorRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Creators")
@RestController
@RequiredArgsConstructor
@RequestMapping("/api")
public class CreatorRestController {

    private final CreatorService creatorService;

    @Operation(summary = "Public creator profile with their published reels")
    @GetMapping("/creators/{username}")
    public CreatorProfileDto profile(@PathVariable String username) {
        return creatorService.publicProfile(username);
    }

    /* ---- admin (ADMIN role only — enforced in SecurityConfig) ---- */

    @GetMapping("/admin/creators")
    public List<CreatorAdminDto> adminList() {
        return creatorService.adminList();
    }

    @PostMapping("/admin/creators")
    @ResponseStatus(HttpStatus.CREATED)
    public CreatorAdminDto create(@Valid @RequestBody CreatorRequest request) {
        return creatorService.create(request);
    }

    @Operation(summary = "Update a creator — also rewrites the snapshot on all their reels")
    @PutMapping("/admin/creators/{id}")
    public CreatorAdminDto update(@PathVariable String id, @Valid @RequestBody CreatorRequest request) {
        return creatorService.update(id, request);
    }
}
