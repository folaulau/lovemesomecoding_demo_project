package com.pizza.api.storage;

import com.pizza.api.config.PizzaProperties;
import com.pizza.api.exception.ApiException;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

/**
 * Local-disk image storage.
 *
 * <p>Deliberately the simplest thing that works, so the upload mechanics stay visible. A real
 * deployment writes to S3 or another object store instead — local disk does not survive a container
 * restart and is not shared between instances, so the second replica serves 404s for anything the
 * first one stored.
 *
 * <h2>Everything below the validation comment is security, not ceremony</h2>
 *
 * <p>An upload endpoint accepts a file chosen by a stranger. Three separate things have to be
 * distrusted, and each has bitten real systems:
 *
 * <ol>
 *   <li><b>The filename.</b> {@code ../../../etc/passwd} is a path, not a name. Resolving it
 *       against the upload directory writes outside the upload directory. We discard the sent name
 *       entirely and generate our own.
 *   <li><b>The declared content type.</b> {@code Content-Type} is set by the client and is simply a
 *       claim. Checking it stops honest mistakes and nothing else.
 *   <li><b>The bytes.</b> The only trustworthy signal. We read the magic-number prefix and require
 *       it to match a real image format.
 * </ol>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProductImageStorageServiceImpl implements ProductImageStorageService {

    /** Extensions we are willing to serve back, mapped from the format we detected. */
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp", "gif");

    /**
     * The first bytes of each format we accept — the "magic number". These are what a file actually
     * is, as opposed to what its name or its Content-Type header claims it is.
     */
    private static final Map<String, byte[]> MAGIC_NUMBERS = Map.of(
            "jpg", new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF},
            "png", new byte[] {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A},
            "gif", new byte[] {'G', 'I', 'F', '8'},
            "webp", new byte[] {'R', 'I', 'F', 'F'});

    private final PizzaProperties properties;

    private Path uploadRoot;

    @PostConstruct
    void init() throws IOException {
        // normalize() collapses any ".." in the CONFIGURED path; toAbsolutePath() gives us a fixed
        // root to compare against later.
        this.uploadRoot =
                Path.of(properties.storage().uploadDir()).toAbsolutePath().normalize();
        Files.createDirectories(uploadRoot);
        log.info("Product images are stored in {}", uploadRoot);
    }

    @Override
    public String store(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("No file was uploaded");
        }
        if (file.getSize() > properties.storage().maxImageBytes()) {
            throw ApiException.badRequest(
                    "Image must be smaller than " + (properties.storage().maxImageBytes() / 1024 / 1024) + " MB");
        }

        String format = detectImageFormat(file);

        // The browser's filename is used for NOTHING except this log line. The stored name is a
        // UUID we generate, which makes path traversal and filename collisions both impossible.
        String original =
                StringUtils.cleanPath(file.getOriginalFilename() == null ? "unnamed" : file.getOriginalFilename());
        String storedName = UUID.randomUUID() + "." + format;

        Path target = uploadRoot.resolve(storedName).normalize();
        // Belt and braces. storedName is a UUID we just generated so this cannot currently fail —
        // but it is one refactor away from being caller-influenced, and this check is one line.
        if (!target.getParent().equals(uploadRoot)) {
            throw ApiException.badRequest("Invalid file name");
        }

        try (InputStream in = file.getInputStream()) {
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException ex) {
            log.error("Could not store upload {}", original, ex);
            throw ApiException.badRequest("Could not store the uploaded file");
        }

        log.info("Stored upload '{}' ({} bytes) as {}", original, file.getSize(), storedName);
        return storedName;
    }

    @Override
    public Resource load(String fileName) {
        // fileName reaches us from a path variable, so here the traversal risk is real rather than
        // theoretical. Strip it to a bare name first, then verify where it resolved to.
        String safeName = Path.of(StringUtils.cleanPath(fileName)).getFileName().toString();
        Path target = uploadRoot.resolve(safeName).normalize();

        if (!target.getParent().equals(uploadRoot)) {
            throw ApiException.notFound("Image", fileName);
        }

        try {
            Resource resource = new UrlResource(target.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                throw ApiException.notFound("Image", fileName);
            }
            return resource;
        } catch (IOException ex) {
            throw ApiException.notFound("Image", fileName);
        }
    }

    @Override
    public String urlFor(String fileName) {
        return "/api/products/images/" + fileName;
    }

    /**
     * Reads the leading bytes and returns the format they prove the file to be.
     *
     * <p>Throws rather than returning null: a file whose bytes match no known image format has no
     * business being stored, whatever its name ends in.
     */
    private String detectImageFormat(MultipartFile file) {
        byte[] head = new byte[12];
        try (InputStream in = file.getInputStream()) {
            int read = in.read(head);
            if (read < 4) {
                throw ApiException.badRequest("File is too small to be an image");
            }
        } catch (IOException ex) {
            throw ApiException.badRequest("Could not read the uploaded file");
        }

        for (Map.Entry<String, byte[]> entry : MAGIC_NUMBERS.entrySet()) {
            if (startsWith(head, entry.getValue())) {
                return entry.getKey();
            }
        }

        String declared =
                file.getContentType() == null ? "none" : file.getContentType().toLowerCase(Locale.ROOT);
        log.warn("Rejected an upload declaring content type {} whose bytes are not an image", declared);
        throw ApiException.badRequest("Only JPEG, PNG, GIF and WebP images are accepted");
    }

    private static boolean startsWith(byte[] data, byte[] prefix) {
        if (data.length < prefix.length) {
            return false;
        }
        for (int i = 0; i < prefix.length; i++) {
            if (data[i] != prefix[i]) {
                return false;
            }
        }
        return true;
    }

    /** Exposed for the controller's Content-Type header. */
    public static boolean isAllowedExtension(String extension) {
        return ALLOWED_EXTENSIONS.contains(extension.toLowerCase(Locale.ROOT));
    }
}
