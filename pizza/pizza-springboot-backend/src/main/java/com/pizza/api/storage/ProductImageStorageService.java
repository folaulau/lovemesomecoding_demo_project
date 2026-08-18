package com.pizza.api.storage;

import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

/** Stores and serves product images. */
public interface ProductImageStorageService {

    /**
     * Validates and stores an upload.
     *
     * @return the generated storage file name, NOT the name the browser sent
     */
    String store(MultipartFile file);

    /** Loads a stored image for streaming back to a client. */
    Resource load(String fileName);

    /** The public URL path an image is served from. */
    String urlFor(String fileName);
}
