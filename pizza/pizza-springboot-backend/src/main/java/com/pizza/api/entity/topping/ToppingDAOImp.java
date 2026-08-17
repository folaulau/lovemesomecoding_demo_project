package com.pizza.api.entity.topping;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

@Slf4j
@Repository
public class ToppingDAOImp implements ToppingDAO {

    @Autowired
    private ToppingRepository toppingRepository;

    @Override
    public List<Topping> findActive() {
        return toppingRepository.findByActiveTrueOrderByCategoryAscNameAsc();
    }

    @Override
    public List<Topping> getAll() {
        return toppingRepository.findAll();
    }

    @Override
    public List<Topping> findAllByPublicIds(List<UUID> publicIds) {
        if (publicIds == null || publicIds.isEmpty()) {
            return List.of();
        }
        return toppingRepository.findByPublicIdIn(publicIds);
    }

    @Override
    public Optional<Topping> findByPublicId(UUID publicId) {
        return toppingRepository.findByPublicId(publicId);
    }

    @Override
    public boolean existsByName(String name) {
        return toppingRepository.existsByNameIgnoreCase(name);
    }

    @Override
    public Topping save(Topping topping) {
        return toppingRepository.saveAndFlush(topping);
    }
}
