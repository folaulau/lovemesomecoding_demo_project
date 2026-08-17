package com.pizza.api.entity.crust;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CrustRepository extends JpaRepository<Crust, Long> {

    List<Crust> findByActiveTrueOrderByDisplayOrderAsc();

    Optional<Crust> findByPublicId(UUID publicId);

    boolean existsByNameIgnoreCase(String name);
}
