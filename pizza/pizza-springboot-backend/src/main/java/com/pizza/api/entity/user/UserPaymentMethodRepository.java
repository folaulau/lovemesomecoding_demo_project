package com.pizza.api.entity.user;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserPaymentMethodRepository extends JpaRepository<UserPaymentMethod, Long> {

    List<UserPaymentMethod> findByUserIdOrderByPrimaryDescCreatedAtDesc(Long userId);

    Optional<UserPaymentMethod> findByPublicId(UUID publicId);
}
