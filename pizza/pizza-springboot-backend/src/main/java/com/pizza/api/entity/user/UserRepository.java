package com.pizza.api.entity.user;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmailIgnoreCase(String email);

    Optional<User> findByPublicId(UUID publicId);

    boolean existsByEmailIgnoreCase(String email);

    /** Newest first — the order the admin list shows them in. */
    java.util.List<User> findAllByOrderByCreatedAtDesc();
}
