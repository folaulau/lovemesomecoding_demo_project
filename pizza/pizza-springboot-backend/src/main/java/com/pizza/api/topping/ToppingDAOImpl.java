package com.pizza.api.topping;

import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class ToppingDAOImpl implements ToppingDAO {

    private final ToppingRepository toppingRepository;

    @Override
    public List<Topping> findActive() {
        return toppingRepository.findByActiveTrueOrderByCategoryAscNameAsc();
    }

    @Override
    public List<Topping> findAll() {
        return toppingRepository.findAll();
    }

    @Override
    public List<Topping> findAllByIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        return toppingRepository.findByIdIn(ids);
    }

    @Override
    public Optional<Topping> findById(Long id) {
        return toppingRepository.findById(id);
    }

    @Override
    public boolean existsByName(String name) {
        return toppingRepository.existsByNameIgnoreCase(name);
    }

    @Override
    public Topping save(Topping topping) {
        return toppingRepository.save(topping);
    }

    @Override
    public void deleteById(Long id) {
        toppingRepository.deleteById(id);
    }
}
