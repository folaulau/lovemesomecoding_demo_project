package com.pizza.api.crust;

import java.util.List;
import java.util.Optional;

/** Data-access contract for crusts. See ProductDAO for why this layer exists. */
public interface CrustDAO {

    List<Crust> findActive();

    List<Crust> findAll();

    Optional<Crust> findById(Long id);

    boolean existsByName(String name);

    Crust save(Crust crust);

    void deleteById(Long id);
}
