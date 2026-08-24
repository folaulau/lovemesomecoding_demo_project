package com.reelcms.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * ReelCMS API.
 *
 * <p>@EnableAsync is required by ReelStatsStreamService: a MongoDB change stream is a blocking
 * cursor that never returns, so it has to be consumed on its own thread. @EnableScheduling drives
 * the publisher that promotes SCHEDULED reels once their time arrives.
 */
@EnableAsync
@EnableScheduling
@SpringBootApplication
public class ReelcmsApplication {

    public static void main(String[] args) {
        SpringApplication.run(ReelcmsApplication.class, args);
    }
}
