package com.pizza.api.config;

import java.util.List;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.cache.interceptor.KeyGenerator;
import org.springframework.cache.interceptor.SimpleKey;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Caching for the menu.
 *
 * <p>The menu is the right thing to cache and almost the only one here: every visitor loads it, it
 * is identical for all of them, and it changes only when an administrator edits the catalogue. The
 * cart and the orders are cached nowhere — they are per-user and change constantly, and caching
 * them would be a correctness bug dressed as an optimisation.
 *
 * <h2>Why the cache names are constants</h2>
 *
 * <p>{@code @Cacheable} and {@code @CacheEvict} refer to a cache by a string. Spelling it
 * differently in the two places is the classic caching bug: reads populate {@code "menu"}, writes
 * evict {@code "menus"}, and stale data is served forever with nothing failing. Constants make the
 * compiler enforce the agreement.
 *
 * <h2>⚠️ ConcurrentMapCacheManager is a single-JVM cache</h2>
 *
 * <p>It is an in-memory {@code ConcurrentHashMap}: nothing evicts by time, nothing bounds its size,
 * and each instance has its own copy. That is fine for one process and wrong the moment there are
 * two — instance A evicts on a write and instance B keeps serving the old menu until it restarts.
 * A real deployment points {@code spring.cache.type} at Redis or Caffeine and gets a shared cache
 * or a TTL. Left simple here on purpose, and called out rather than hidden.
 */
@Configuration
@EnableCaching
public class CacheConfig {

    /** The active, customer-facing menu. */
    public static final String MENU_CACHE = "menu";

    /** The active menu filtered to one product type. */
    public static final String MENU_BY_TYPE_CACHE = "menuByType";

    @Bean
    public ConcurrentMapCacheManager cacheManager() {
        ConcurrentMapCacheManager manager = new ConcurrentMapCacheManager(MENU_CACHE, MENU_BY_TYPE_CACHE);
        // Refuse to create caches that were never declared above. Without this, a typo in a
        // @Cacheable name quietly creates a brand new cache that no @CacheEvict ever clears.
        manager.setAllowNullValues(false);
        return manager;
    }

    /**
     * The default key generator hashes every method argument together. That is reasonable until a
     * no-argument method appears: {@code getMenu()} and any other no-argument method on the same
     * cache both key to {@link SimpleKey#EMPTY}. Naming the method removes the collision.
     */
    @Bean
    public KeyGenerator methodAwareKeyGenerator() {
        return (target, method, params) ->
                params.length == 0 ? method.getName() : method.getName() + "-" + List.of(params);
    }
}
