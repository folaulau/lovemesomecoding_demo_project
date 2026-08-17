package com.pizza.api.entity.cart;

import com.pizza.api.dto.CartDTO;
import com.pizza.api.dto.CartWriteDTO;
import java.util.UUID;

public interface CartService {

    /** Creates an empty cart and returns it, including the UUID the browser must keep. */
    CartDTO createCart(String userEmail);

    /** Fetches a cart, priced from the current catalogue. */
    CartDTO getCart(UUID cartId);

    /** Replaces the cart's entire contents. Idempotent. */
    CartDTO replaceCart(UUID cartId, CartWriteDTO dto, String userEmail);

    /** Empties the cart but keeps it, so the browser's stored id stays valid. */
    CartDTO clearCart(UUID cartId);
}
