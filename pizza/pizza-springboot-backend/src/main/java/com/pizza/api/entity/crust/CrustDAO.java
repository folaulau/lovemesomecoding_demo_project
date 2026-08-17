package com.pizza.api.entity.crust;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Data-access contract for crusts. See ProductDAO for why this layer exists. */
public interface CrustDAO {

    List<Crust> findActive();

    List<Crust> getAll();

    Optional<Crust> findByPublicId(UUID publicId);

    boolean existsByName(String name);

    Crust save(Crust crust);
}
