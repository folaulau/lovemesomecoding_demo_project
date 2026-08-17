package com.pizza.api.entity.topping;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Data-access contract for toppings. See ProductDAO for why this layer exists. */
public interface ToppingDAO {

    List<Topping> findActive();

    List<Topping> getAll();

    /** Bulk lookup used when pricing an order — one query instead of one per topping. */
    List<Topping> findAllByPublicIds(List<UUID> publicIds);

    Optional<Topping> findByPublicId(UUID publicId);

    boolean existsByName(String name);

    Topping save(Topping topping);
}
