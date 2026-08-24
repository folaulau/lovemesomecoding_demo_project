package com.reelcms.api.entity.reelcollection;

import com.reelcms.api.dto.Dtos.CollectionDto;
import com.reelcms.api.dto.Dtos.CollectionPageDto;
import com.reelcms.api.dto.Dtos.CollectionRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Collections")
@RestController
@RequiredArgsConstructor
@RequestMapping("/api")
public class ReelCollectionRestController {

    private final ReelCollectionService collectionService;

    @GetMapping("/collections")
    public List<CollectionDto> list() {
        return collectionService.list();
    }

    @Operation(summary = "A collection and its published reels")
    @GetMapping("/collections/{slug}")
    public CollectionPageDto bySlug(@PathVariable String slug) {
        return collectionService.bySlug(slug);
    }

    /* ---- admin ---- */

    @GetMapping("/admin/collections")
    public List<CollectionDto> adminList() {
        return collectionService.list();
    }

    @PostMapping("/admin/collections")
    @ResponseStatus(HttpStatus.CREATED)
    public CollectionDto create(@Valid @RequestBody CollectionRequest request) {
        return collectionService.create(request);
    }

    @PutMapping("/admin/collections/{id}")
    public CollectionDto update(@PathVariable String id, @Valid @RequestBody CollectionRequest request) {
        return collectionService.update(id, request);
    }

    @DeleteMapping("/admin/collections/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        collectionService.delete(id);
    }
}
