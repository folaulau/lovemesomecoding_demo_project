package com.pizza.api.entity.cart;

import com.pizza.api.config.PizzaProperties;
import com.pizza.api.dto.CartDTO;
import com.pizza.api.dto.CartItemDTO;
import com.pizza.api.dto.CartWriteDTO;
import com.pizza.api.entity.crust.Crust;
import com.pizza.api.entity.crust.CrustDAO;
import com.pizza.api.entity.order.OrderType;
import com.pizza.api.entity.product.Product;
import com.pizza.api.entity.product.ProductDAO;
import com.pizza.api.entity.topping.Topping;
import com.pizza.api.entity.topping.ToppingDAO;
import com.pizza.api.entity.user.User;
import com.pizza.api.entity.user.UserDAO;
import com.pizza.api.exception.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Saved carts.
 *
 * <p>The stored cart holds identifiers only. Every figure below is derived from the CURRENT
 * catalogue each time the cart is read, so there is exactly one place prices come from and a cart
 * left overnight picks up today's menu rather than quietly honouring yesterday's.
 */
@Service
@Slf4j
public class CartServiceImpl implements CartService {

    @Autowired
    private CartDAO cartDAO;

    @Autowired
    private ProductDAO productDAO;

    @Autowired
    private CrustDAO crustDAO;

    @Autowired
    private ToppingDAO toppingDAO;

    @Autowired
    private UserDAO userDAO;

    @Autowired
    private PizzaProperties properties;

    @Override
    @Transactional
    public CartDTO createCart(String userEmail) {
        Cart cart = Cart.builder()
                .user(resolveUser(userEmail))
                .orderType(OrderType.DELIVERY)
                .build();

        Cart saved = cartDAO.save(cart);
        log.info("Created cart {}", saved.getPublicId());
        return toDto(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public CartDTO getCart(UUID cartId) {
        return toDto(loadCart(cartId));
    }

    @Override
    @Transactional
    public CartDTO replaceCart(UUID cartId, CartWriteDTO dto, String userEmail) {
        Cart cart = loadCart(cartId);
        cart.setOrderType(dto.orderType());

        // Attach the cart to an account the moment we know who is holding it, so a signed-in
        // customer's cart is recoverable server-side rather than only via the browser's id.
        if (cart.getUser() == null) {
            User user = resolveUser(userEmail);
            if (user != null) {
                cart.setUser(user);
            }
        }

        /*
         * Replace the lines wholesale. Unlike product sizes (see ProductServiceImpl.mergeSizes),
         * cart lines have no unique key across a natural identity and no publicId a client holds
         * onto between edits, so clear-and-rebuild is safe here — and far simpler than diffing.
         */
        cart.getItems().clear();

        for (CartWriteDTO.ItemDTO line : dto.items() == null ? List.<CartWriteDTO.ItemDTO>of() : dto.items()) {
            cart.addItem(buildItem(line));
        }

        Cart saved = cartDAO.save(cart);
        log.debug(
                "Cart {} now has {} lines",
                saved.getPublicId(),
                saved.getItems().size());
        return toDto(saved);
    }

    @Override
    @Transactional
    public CartDTO clearCart(UUID cartId) {
        Cart cart = loadCart(cartId);
        cart.getItems().clear();
        return toDto(cartDAO.save(cart));
    }

    // ------------------------------------------------------------------ helpers

    private Cart loadCart(UUID cartId) {
        return cartDAO.findByPublicIdWithItems(cartId).orElseThrow(() -> ApiException.notFound("Cart", cartId));
    }

    private User resolveUser(String userEmail) {
        return userEmail == null ? null : userDAO.findByEmail(userEmail).orElse(null);
    }

    private CartItem buildItem(CartWriteDTO.ItemDTO line) {
        Product product = productDAO
                .findByPublicIdWithSizes(line.productId())
                .orElseThrow(() -> ApiException.badRequest("Unknown product: " + line.productId()));

        // Validate the size exists for this product now, rather than discovering it at checkout.
        product.priceFor(line.size())
                .orElseThrow(() -> ApiException.badRequest(product.getName() + " is not sold in size " + line.size()));

        CartItem item = CartItem.builder()
                .product(product)
                .size(line.size())
                .quantity(line.quantity())
                .build();

        if (line.crustId() != null) {
            Crust crust = crustDAO.findByPublicId(line.crustId())
                    .orElseThrow(() -> ApiException.badRequest("Unknown crust: " + line.crustId()));
            item.setCrust(crust);
        }

        if (line.toppingIds() != null) {
            for (Topping topping : resolveToppings(line.toppingIds())) {
                item.addTopping(CartItemTopping.builder().topping(topping).build());
            }
        }

        return item;
    }

    private List<Topping> resolveToppings(List<UUID> toppingIds) {
        List<UUID> distinct = toppingIds.stream().distinct().toList();
        Map<UUID, Topping> byId = new HashMap<>();
        for (Topping topping : toppingDAO.findAllByPublicIds(distinct)) {
            byId.put(topping.getPublicId(), topping);
        }

        List<Topping> resolved = new ArrayList<>();
        for (UUID id : distinct) {
            Topping topping = byId.get(id);
            if (topping == null) {
                throw ApiException.badRequest("Unknown topping: " + id);
            }
            resolved.add(topping);
        }
        return resolved;
    }

    /** Prices the stored cart from the current catalogue. */
    private CartDTO toDto(Cart cart) {
        List<CartItemDTO> items = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;
        int count = 0;

        for (CartItem item : cart.getItems()) {
            Product product = item.getProduct();
            BigDecimal base = product.priceFor(item.getSize()).orElse(BigDecimal.ZERO);
            BigDecimal unit = base;

            Crust crust = item.getCrust();
            if (crust != null) {
                unit = unit.add(crust.getPriceDelta());
            }

            List<CartItemDTO.CartItemToppingDTO> toppings = new ArrayList<>();
            for (CartItemTopping cit : item.getToppings()) {
                Topping topping = cit.getTopping();
                toppings.add(new CartItemDTO.CartItemToppingDTO(
                        topping.getPublicId(), topping.getName(), topping.getPrice()));
                unit = unit.add(topping.getPrice());
            }

            unit = scale(unit);
            BigDecimal lineTotal = scale(unit.multiply(BigDecimal.valueOf(item.getQuantity())));
            subtotal = subtotal.add(lineTotal);
            count += item.getQuantity();

            items.add(new CartItemDTO(
                    item.getPublicId(),
                    product.getPublicId(),
                    product.getName(),
                    product.getType().name(),
                    item.getSize(),
                    crust == null ? null : crust.getPublicId(),
                    crust == null ? null : crust.getName(),
                    item.getQuantity(),
                    toppings,
                    unit,
                    lineTotal));
        }

        subtotal = scale(subtotal);
        BigDecimal fee = cart.getOrderType() == OrderType.DELIVERY && subtotal.signum() > 0
                ? scale(properties.pricing().deliveryFee())
                : BigDecimal.ZERO;
        BigDecimal tax = scale(subtotal.multiply(properties.pricing().taxRate()));

        return new CartDTO(
                cart.getPublicId(),
                cart.getOrderType(),
                items,
                subtotal,
                tax,
                fee,
                scale(subtotal.add(tax).add(fee)),
                count);
    }

    private BigDecimal scale(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }
}
