package com.pizza.api.topping;

import java.util.List;
import java.util.Optional;

/** Data-access contract for toppings. See ProductDAO for why this layer exists. */
public interface ToppingDAO {

    List<Topping> findActive();

    List<Topping> findAll();

    /** Bulk lookup used when pricing an order — one query instead of one per topping. */
    List<Topping> findAllByIds(List<Long> ids);

    Optional<Topping> findById(Long id);

    boolean existsByName(String name);

    Topping save(Topping topping);

    void deleteById(Long id);
}
