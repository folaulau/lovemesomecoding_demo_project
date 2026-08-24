package com.reelcms.api.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.reelcms.api.exception.ApiException;
import java.io.IOException;
import java.nio.file.Path;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

class MediaStorageServiceTest {

    @TempDir
    Path tempDir;

    private MediaStorageService service;

    @BeforeEach
    void setUp() throws IOException {
        service = new MediaStorageService(tempDir.toString());
        service.ensureDirectories();
    }

    @Test
    void storesAVideoAndReturnsItsUrl() {
        var file = new MockMultipartFile("file", "clip.mp4", "video/mp4", "fake-bytes".getBytes());

        var response = service.storeVideo(file);

        assertThat(response.url()).startsWith("/media/videos/").endsWith(".mp4");
        assertThat(response.sizeBytes()).isEqualTo(10);
        assertThat(tempDir.resolve("videos").resolve(fileNameOf(response.url())))
                .exists();
    }

    @Test
    @DisplayName("the stored name is a UUID, not the client's filename")
    void doesNotTrustTheClientFilename() {
        // The client filename is attacker-controlled. A UUID name defuses both path
        // traversal and two users overwriting each other's "clip.mp4".
        var file = new MockMultipartFile("file", "../../../etc/passwd.mp4", "video/mp4", "x".getBytes());

        var response = service.storeVideo(file);

        assertThat(response.url()).doesNotContain("..").doesNotContain("passwd");
        assertThat(fileNameOf(response.url())).matches("[0-9a-f-]{36}\\.mp4");
    }

    @Test
    @DisplayName("two uploads of the same filename do not collide")
    void generatesUniqueNames() {
        var a = service.storeVideo(new MockMultipartFile("file", "clip.mp4", "video/mp4", "a".getBytes()));
        var b = service.storeVideo(new MockMultipartFile("file", "clip.mp4", "video/mp4", "b".getBytes()));

        assertThat(a.url()).isNotEqualTo(b.url());
    }

    @Test
    void rejectsAnUnsupportedVideoType() {
        var file = new MockMultipartFile("file", "notes.txt", "text/plain", "hello".getBytes());

        assertThatThrownBy(() -> service.storeVideo(file))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("MP4");
    }

    @Test
    void rejectsAnImagePostedAsAVideo() {
        var file = new MockMultipartFile("file", "poster.png", "image/png", "x".getBytes());

        assertThatThrownBy(() -> service.storeVideo(file)).isInstanceOf(ApiException.class);
    }

    @Test
    void rejectsAnEmptyUpload() {
        var file = new MockMultipartFile("file", "clip.mp4", "video/mp4", new byte[0]);

        assertThatThrownBy(() -> service.storeVideo(file))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("No file");
    }

    @Test
    void storesAPoster() {
        var file = new MockMultipartFile("file", "poster.png", "image/png", "png".getBytes());

        assertThat(service.storePoster(file).url())
                .startsWith("/media/posters/")
                .endsWith(".png");
    }

    @Test
    @DisplayName("a missing extension is derived from the content type")
    void derivesExtensionFromContentType() {
        var file = new MockMultipartFile("file", "no-extension", "video/webm", "x".getBytes());

        assertThat(service.storeVideo(file).url()).endsWith(".webm");
    }

    private String fileNameOf(String url) {
        return url.substring(url.lastIndexOf('/') + 1);
    }
}
