package com.pizza.api.entity.user;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserAddressRepository extends JpaRepository<UserAddress, Long> {

    /** Primary first, then newest — the order the chooser shows them in. */
    List<UserAddress> findByUserIdOrderByPrimaryDescCreatedAtDesc(Long userId);

    Optional<UserAddress> findByPublicId(UUID publicId);
}
