package com.reelcms.api.config;

import java.nio.file.Path;
import java.nio.file.Paths;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Serves uploaded media straight off disk at /media/**.
 *
 * <p>This is the demo-appropriate answer, not the production one. In production the videos live in
 * object storage behind a CDN and this application never touches the bytes - streaming a 40 MB file
 * through a servlet thread ties that thread up for the whole download, and a few dozen concurrent
 * viewers will exhaust the pool. The upload path is deliberately isolated in MediaStorageService so
 * that swapping in S3 is one class.
 */
@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

    @Value("${reelcms.media.dir}")
    private String mediaDir;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path root = Paths.get(mediaDir).toAbsolutePath().normalize();
        registry.addResourceHandler("/media/**")
                // The trailing separator is required. "file:/a/b" resolves
                // /media/x.mp4 against the PARENT of b, so requests land one directory
                // up and 404 - with no hint as to why.
                .addResourceLocations("file:" + root + "/")
                .setCachePeriod(3600);
    }
}
