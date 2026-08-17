package com.pizza.api.crust;

import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class CrustDAOImpl implements CrustDAO {

    private final CrustRepository crustRepository;

    @Override
    public List<Crust> findActive() {
        return crustRepository.findByActiveTrueOrderByDisplayOrderAsc();
    }

    @Override
    public List<Crust> findAll() {
        return crustRepository.findAll();
    }

    @Override
    public Optional<Crust> findById(Long id) {
        return crustRepository.findById(id);
    }

    @Override
    public boolean existsByName(String name) {
        return crustRepository.existsByNameIgnoreCase(name);
    }

    @Override
    public Crust save(Crust crust) {
        return crustRepository.save(crust);
    }

    @Override
    public void deleteById(Long id) {
        crustRepository.deleteById(id);
    }
}
