package com.pizza.api.entity.cart;

import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Repository
public class CartDAOImp implements CartDAO {

    @Autowired
    private CartRepository cartRepository;

    @Override
    public Optional<Cart> findByPublicId(UUID publicId) {
        return cartRepository.findByPublicId(publicId);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Cart> findByPublicIdWithItems(UUID publicId) {
        Optional<Cart> cart = cartRepository.findWithItemsByPublicId(publicId);
        // Force the second collection to load while the session is open.
        cart.ifPresent(c -> c.getItems().forEach(item -> item.getToppings().size()));
        return cart;
    }

    @Override
    public Cart save(Cart cart) {
        return cartRepository.saveAndFlush(cart);
    }
}
