package com.reelcms.api.storage;

import com.reelcms.api.dto.Dtos.UploadResponse;
import com.reelcms.api.exception.ApiException;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

/**
 * Writes uploads to a local directory and returns the URL they will be served from.
 *
 * <p>Deliberately the ONLY class that touches the filesystem, so swapping in S3 means replacing
 * this one file and nothing else. In production that is what you would do - a servlet streaming a
 * 40 MB video occupies a request thread for the whole download.
 */
@Slf4j
@Service
public class MediaStorageService {

    private static final List<String> VIDEO_TYPES = List.of("video/mp4", "video/webm", "video/quicktime");
    private static final List<String> IMAGE_TYPES = List.of("image/jpeg", "image/png", "image/webp");

    private final Path root;

    public MediaStorageService(@Value("${reelcms.media.dir}") String mediaDir) {
        this.root = Paths.get(mediaDir).toAbsolutePath().normalize();
    }

    @PostConstruct
    void ensureDirectories() throws IOException {
        Files.createDirectories(root.resolve("videos"));
        Files.createDirectories(root.resolve("posters"));
        log.info("Media directory: {}", root);
    }

    public UploadResponse storeVideo(MultipartFile file) {
        return store(file, "videos", VIDEO_TYPES, "Only MP4, WebM or MOV files are accepted.");
    }

    public UploadResponse storePoster(MultipartFile file) {
        return store(file, "posters", IMAGE_TYPES, "Only JPEG, PNG or WebP images are accepted.");
    }

    private UploadResponse store(MultipartFile file, String folder, List<String> allowedTypes, String typeError) {
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("No file was uploaded.");
        }

        String contentType =
                file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        if (!allowedTypes.contains(contentType)) {
            throw ApiException.badRequest(typeError);
        }

        // A UUID name, NOT the client's filename. Two reasons and both matter:
        //   - "../../etc/passwd" as a filename is a path traversal; Mongo will store
        //     whatever string you give it and Files.resolve will happily follow it.
        //   - two users uploading "clip.mp4" must not overwrite each other.
        String extension = extensionOf(file.getOriginalFilename(), contentType);
        String name = UUID.randomUUID() + extension;
        Path target = root.resolve(folder).resolve(name).normalize();

        // Belt and braces: even with a generated name, confirm the resolved path is
        // still inside the media root before writing to it.
        if (!target.startsWith(root)) {
            throw ApiException.badRequest("Invalid upload path.");
        }

        try (var in = file.getInputStream()) {
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException ex) {
            log.error("Failed to store upload", ex);
            throw new ApiException(
                    org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR, "Could not save the file.");
        }

        return new UploadResponse("/media/" + folder + "/" + name, file.getSize(), contentType);
    }

    private String extensionOf(String originalName, String contentType) {
        if (StringUtils.hasText(originalName) && originalName.contains(".")) {
            String ext = originalName.substring(originalName.lastIndexOf('.')).toLowerCase(Locale.ROOT);
            // Only accept a short, alphanumeric extension - anything else is discarded
            // rather than trusted.
            if (ext.matches("\\.[a-z0-9]{2,5}")) {
                return ext;
            }
        }
        return switch (contentType) {
            case "video/mp4" -> ".mp4";
            case "video/webm" -> ".webm";
            case "video/quicktime" -> ".mov";
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            default -> ".jpg";
        };
    }
}
