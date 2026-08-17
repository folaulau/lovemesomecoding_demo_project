package com.pizza.api.topping;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ToppingRepository extends JpaRepository<Topping, Long> {

    List<Topping> findByActiveTrueOrderByCategoryAscNameAsc();

    List<Topping> findByIdIn(List<Long> ids);

    boolean existsByNameIgnoreCase(String name);
}
