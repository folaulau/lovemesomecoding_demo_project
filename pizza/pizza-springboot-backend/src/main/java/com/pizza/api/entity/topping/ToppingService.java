package com.pizza.api.entity.topping;

import com.pizza.api.dto.ToppingCreateDTO;
import com.pizza.api.dto.ToppingDTO;
import java.util.List;
import java.util.UUID;

public interface ToppingService {

    List<ToppingDTO> getActiveToppings();

    List<ToppingDTO> getAllToppings();

    ToppingDTO getToppingByPublicId(UUID id);

    ToppingDTO createTopping(ToppingCreateDTO dto);

    ToppingDTO updateTopping(UUID id, ToppingCreateDTO dto);

    void deactivateTopping(UUID id);

    void deleteTopping(UUID id);
}
