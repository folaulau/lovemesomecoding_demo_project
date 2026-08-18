package com.pizza.api.entity.user;

import com.pizza.api.dto.AdminUserDTO;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Data-access contract for users. See ProductDAO for why this layer exists.
 *
 * <p>The implementation is backed by two things at once, and the split is deliberate: the Spring
 * Data repository handles saves and single-row lookups, while the one query that has to aggregate
 * across three tables is written as SQL. {@link #findAllForAdmin()} is the interesting one.
 */
public interface UserDAO {

    /** Case-insensitive: signing up as Bob@x.com and logging in as bob@x.com must be one account. */
    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    Optional<User> findByPublicId(UUID publicId);

    List<User> getAll();

    /** Newest first — the order the admin list shows them in. */
    List<User> getAllNewestFirst();

    /**
     * Every account with its order, address and saved-card counts, newest first.
     *
     * <p>Returns the DTO rather than entities on purpose: the counts are not fields on {@code User}
     * and never should be, since loading a user for any other reason has no business running three
     * aggregates. This is a read model, not the entity.
     */
    List<AdminUserDTO> findAllForAdmin();

    User save(User user);
}
