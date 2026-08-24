package com.reelcms.api.config;

import java.util.Optional;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.auditing.DateTimeProvider;
import org.springframework.data.mongodb.config.EnableMongoAuditing;

/**
 * @EnableMongoAuditing is what makes @CreatedDate and @LastModifiedDate actually populate.
 *
 * <p>Without this annotation those fields simply stay null. Nothing warns you, nothing fails - you
 * just end up with a collection full of documents with no timestamps, usually discovered when a
 * sort by createdAt returns them in an arbitrary order.
 *
 * <p>The custom DateTimeProvider routes auditing through {@link Timestamps} so audit fields get the
 * same millisecond truncation as every other timestamp in the app. See that class for why.
 */
@Configuration
@EnableMongoAuditing(dateTimeProviderRef = "millisecondDateTimeProvider")
public class MongoConfig {

    @Bean
    public DateTimeProvider millisecondDateTimeProvider() {
        return () -> Optional.of(Timestamps.now());
    }
}
