package com.pizza.api.entity.topping;

import com.pizza.api.dto.EntityDTOMapper;
import com.pizza.api.dto.ToppingCreateDTO;
import com.pizza.api.dto.ToppingDTO;
import com.pizza.api.exception.ApiException;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Slf4j
public class ToppingServiceImpl implements ToppingService {

    @Autowired
    private ToppingDAO toppingDAO;

    @Autowired
    private EntityDTOMapper mapper;

    @Override
    @Transactional(readOnly = true)
    public List<ToppingDTO> getActiveToppings() {
        return mapper.mapToppingsToToppingDTOs(toppingDAO.findActive());
    }

    @Override
    @Transactional(readOnly = true)
    public List<ToppingDTO> getAllToppings() {
        return mapper.mapToppingsToToppingDTOs(toppingDAO.getAll());
    }

    @Override
    @Transactional(readOnly = true)
    public ToppingDTO getToppingByPublicId(UUID id) {
        return toppingDAO
                .findByPublicId(id)
                .map(mapper::mapToppingToToppingDTO)
                .orElseThrow(() -> ApiException.notFound("Topping", id));
    }

    @Override
    @Transactional
    public ToppingDTO createTopping(ToppingCreateDTO dto) {
        log.info("Creating topping {}", dto.name());
        if (toppingDAO.existsByName(dto.name())) {
            throw ApiException.badRequest("A topping named '" + dto.name() + "' already exists");
        }
        Topping topping = mapper.mapToppingCreateDTOToTopping(dto);
        topping.setActive(dto.active() == null || dto.active());
        return mapper.mapToppingToToppingDTO(toppingDAO.save(topping));
    }

    @Override
    @Transactional
    public ToppingDTO updateTopping(UUID id, ToppingCreateDTO dto) {
        log.info("Updating topping {}", id);
        Topping topping = toppingDAO.findByPublicId(id).orElseThrow(() -> ApiException.notFound("Topping", id));
        topping.setName(dto.name());
        topping.setPrice(dto.price());
        topping.setCategory(dto.category());
        if (dto.active() != null) {
            topping.setActive(dto.active());
        }
        return mapper.mapToppingToToppingDTO(toppingDAO.save(topping));
    }

    @Override
    @Transactional
    public void deactivateTopping(UUID id) {
        Topping topping = toppingDAO.findByPublicId(id).orElseThrow(() -> ApiException.notFound("Topping", id));
        topping.setActive(false);
        toppingDAO.save(topping);
    }

    @Override
    @Transactional
    public void deleteTopping(UUID id) {
        Topping topping = toppingDAO.findByPublicId(id).orElseThrow(() -> ApiException.notFound("Topping", id));
        topping.setDeleted(true);
        toppingDAO.save(topping);
    }
}
