package com.pizza.api.entity.crust;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

@Slf4j
@Repository
public class CrustDAOImp implements CrustDAO {

    @Autowired
    private CrustRepository crustRepository;

    @Override
    public List<Crust> findActive() {
        return crustRepository.findByActiveTrueOrderByDisplayOrderAsc();
    }

    @Override
    public List<Crust> getAll() {
        return crustRepository.findAll();
    }

    @Override
    public Optional<Crust> findByPublicId(UUID publicId) {
        return crustRepository.findByPublicId(publicId);
    }

    @Override
    public boolean existsByName(String name) {
        return crustRepository.existsByNameIgnoreCase(name);
    }

    @Override
    public Crust save(Crust crust) {
        return crustRepository.saveAndFlush(crust);
    }
}
