package com.pizza.api.entity.order;

import com.pizza.api.dto.OrderCreateDTO;
import com.pizza.api.entity.crust.Crust;
import com.pizza.api.entity.crust.CrustDAO;
import com.pizza.api.entity.product.Product;
import com.pizza.api.entity.product.ProductDAO;
import com.pizza.api.entity.topping.Topping;
import com.pizza.api.entity.topping.ToppingDAO;
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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Turns a request into priced order lines, using prices read from the database.
 *
 * <p><b>This class is the security boundary of the whole checkout.</b> Every figure it produces
 * comes from the {@code product_size}, {@code crust} and {@code topping} tables. Nothing in
 * {@link OrderCreateDTO} influences a price — the request only chooses WHICH rows apply.
 *
 * <p>If you take one thing from this codebase: never let the client tell you what something costs.
 * It is the single most common e-commerce vulnerability, and it is trivially exploitable with any
 * HTTP client.
 */
@Service
@Slf4j
public class PricingService {

    @Autowired
    private ProductDAO productDAO;

    @Autowired
    private CrustDAO crustDAO;

    @Autowired
    private ToppingDAO toppingDAO;

    @Value("${pizza.pricing.tax-rate}")
    private BigDecimal taxRate;

    @Value("${pizza.pricing.delivery-fee}")
    private BigDecimal deliveryFee;

    /** A fully priced order, ready to persist. */
    public record PricedOrder(
            List<OrderItem> items, BigDecimal subtotal, BigDecimal tax, BigDecimal deliveryFee, BigDecimal total) {}

    @Transactional(readOnly = true)
    public PricedOrder price(OrderCreateDTO dto) {
        List<OrderItem> items = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;

        // Load every topping the order mentions in ONE query rather than one per line.
        Map<UUID, Topping> toppingsByPublicId = loadToppings(dto);

        for (OrderCreateDTO.ItemDTO line : dto.items()) {
            Product product = productDAO
                    .findByPublicIdWithSizes(line.productId())
                    .orElseThrow(() -> ApiException.badRequest("Unknown product: " + line.productId()));

            if (!product.isActive()) {
                throw ApiException.badRequest(product.getName() + " is no longer available");
            }

            // Price for the requested size, straight from the database.
            BigDecimal basePrice = product.priceFor(line.size())
                    .orElseThrow(
                            () -> ApiException.badRequest(product.getName() + " is not sold in size " + line.size()));

            OrderItem item = OrderItem.builder()
                    .product(product)
                    // Snapshot the name so the order still reads correctly if the menu changes.
                    .productName(product.getName())
                    .size(line.size())
                    .quantity(line.quantity())
                    .build();

            BigDecimal unitPrice = basePrice;

            if (line.crustId() != null) {
                Crust crust = crustDAO.findByPublicId(line.crustId())
                        .orElseThrow(() -> ApiException.badRequest("Unknown crust: " + line.crustId()));
                if (!crust.isActive()) {
                    throw ApiException.badRequest(crust.getName() + " is no longer available");
                }
                item.setCrust(crust);
                item.setCrustName(crust.getName());
                unitPrice = unitPrice.add(crust.getPriceDelta());
            }

            if (line.toppingIds() != null) {
                for (UUID toppingId : line.toppingIds()) {
                    Topping topping = toppingsByPublicId.get(toppingId);
                    if (topping == null) {
                        throw ApiException.badRequest("Unknown topping: " + toppingId);
                    }
                    if (!topping.isActive()) {
                        throw ApiException.badRequest(topping.getName() + " is no longer available");
                    }
                    item.addTopping(OrderItemTopping.builder()
                            .topping(topping)
                            .toppingName(topping.getName())
                            .price(topping.getPrice())
                            .build());
                    unitPrice = unitPrice.add(topping.getPrice());
                }
            }

            unitPrice = scale(unitPrice);
            BigDecimal lineTotal = scale(unitPrice.multiply(BigDecimal.valueOf(line.quantity())));

            item.setUnitPrice(unitPrice);
            item.setLineTotal(lineTotal);
            items.add(item);

            subtotal = subtotal.add(lineTotal);
        }

        subtotal = scale(subtotal);
        BigDecimal fee = dto.orderType() == OrderType.DELIVERY ? scale(deliveryFee) : BigDecimal.ZERO;
        BigDecimal tax = scale(subtotal.multiply(taxRate));
        BigDecimal total = scale(subtotal.add(tax).add(fee));

        log.debug("Priced {} lines: subtotal={} tax={} fee={} total={}", items.size(), subtotal, tax, fee, total);
        return new PricedOrder(items, subtotal, tax, fee, total);
    }

    private Map<UUID, Topping> loadToppings(OrderCreateDTO dto) {
        List<UUID> ids = dto.items().stream()
                .filter(item -> item.toppingIds() != null)
                .flatMap(item -> item.toppingIds().stream())
                .distinct()
                .toList();

        Map<UUID, Topping> byId = new HashMap<>();
        for (Topping topping : toppingDAO.findAllByPublicIds(ids)) {
            byId.put(topping.getPublicId(), topping);
        }
        return byId;
    }

    /** Money is always 2dp, rounded half-up — the rounding people expect on a receipt. */
    private BigDecimal scale(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }
}
