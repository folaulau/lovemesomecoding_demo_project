package com.pizza.api.user;

import java.util.List;
import java.util.Optional;

/** Data-access contract for users. See ProductDAO for why this layer exists. */
public interface UserDAO {

    /** Case-insensitive: signing up as Bob@x.com and logging in as bob@x.com must be one account. */
    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    Optional<User> findById(Long id);

    List<User> findAll();

    User save(User user);
}
