package com.reelcms.api.storage;

import com.reelcms.api.dto.Dtos.UploadResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "Admin · Uploads")
@RestController
@RequestMapping("/api/admin/uploads")
@RequiredArgsConstructor
public class UploadRestController {

    private final MediaStorageService storage;

    @Operation(summary = "Upload a video file")
    @PostMapping("/video")
    public UploadResponse video(@RequestParam("file") MultipartFile file) {
        return storage.storeVideo(file);
    }

    @Operation(summary = "Upload a poster image")
    @PostMapping("/poster")
    public UploadResponse poster(@RequestParam("file") MultipartFile file) {
        return storage.storePoster(file);
    }
}
