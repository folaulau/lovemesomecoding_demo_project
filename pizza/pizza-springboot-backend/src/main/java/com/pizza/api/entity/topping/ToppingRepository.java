package com.pizza.api.entity.topping;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ToppingRepository extends JpaRepository<Topping, Long> {

    List<Topping> findByActiveTrueOrderByCategoryAscNameAsc();

    Optional<Topping> findByPublicId(UUID publicId);

    /** Bulk lookup used when pricing an order — one query instead of one per topping. */
    List<Topping> findByPublicIdIn(List<UUID> publicIds);

    boolean existsByNameIgnoreCase(String name);
}
