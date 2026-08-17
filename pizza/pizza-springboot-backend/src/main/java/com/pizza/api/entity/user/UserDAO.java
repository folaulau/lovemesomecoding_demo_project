package com.pizza.api.entity.user;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Data-access contract for users. See ProductDAO for why this layer exists. */
public interface UserDAO {

    /** Case-insensitive: signing up as Bob@x.com and logging in as bob@x.com must be one account. */
    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    Optional<User> findByPublicId(UUID publicId);

    List<User> getAll();

    User save(User user);
}
