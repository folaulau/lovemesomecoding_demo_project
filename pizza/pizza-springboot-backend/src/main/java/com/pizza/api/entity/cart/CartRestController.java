package com.pizza.api.entity.cart;

import static org.springframework.http.HttpStatus.CREATED;
import static org.springframework.http.HttpStatus.OK;

import com.pizza.api.dto.CartDTO;
import com.pizza.api.dto.CartWriteDTO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Saved carts.
 *
 * <p>Public, like guest checkout: a shopper does not need an account to build a cart. The cart's
 * UUID is the credential — unguessable, and kept in the browser's localStorage. A signed-in
 * caller additionally gets the cart attached to their account.
 */
@Tag(name = "Cart", description = "Server-side carts, so a refresh does not lose the basket")
@RequestMapping("/api/carts")
@RestController
@Slf4j
public class CartRestController {

    @Autowired
    private CartService cartService;

    @Operation(summary = "Create an empty cart and return its UUID")
    @PostMapping
    public ResponseEntity<CartDTO> createCart(Principal principal) {
        String email = principal == null ? null : principal.getName();
        return new ResponseEntity<>(cartService.createCart(email), CREATED);
    }

    @Operation(
            summary = "Fetch a cart, priced from the current menu",
            description = "Prices are recomputed on every read — the cart itself stores only "
                    + "which product, size, crust and toppings were chosen.")
    @GetMapping("/{id}")
    public ResponseEntity<CartDTO> getCart(@PathVariable UUID id) {
        return new ResponseEntity<>(cartService.getCart(id), OK);
    }

    @Operation(
            summary = "Replace the cart's contents",
            description = "Idempotent: the browser sends the whole cart, not a delta.")
    @PutMapping("/{id}")
    public ResponseEntity<CartDTO> replaceCart(
            @PathVariable UUID id, @Valid @RequestBody CartWriteDTO dto, Principal principal) {
        String email = principal == null ? null : principal.getName();
        return new ResponseEntity<>(cartService.replaceCart(id, dto, email), OK);
    }

    @Operation(summary = "Empty the cart but keep it, so the stored id stays valid")
    @DeleteMapping("/{id}")
    public ResponseEntity<CartDTO> clearCart(@PathVariable UUID id) {
        return new ResponseEntity<>(cartService.clearCart(id), OK);
    }
}
