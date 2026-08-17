package com.pizza.api.crust;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CrustRepository extends JpaRepository<Crust, Long> {

    List<Crust> findByActiveTrueOrderByDisplayOrderAsc();

    boolean existsByNameIgnoreCase(String name);
}
