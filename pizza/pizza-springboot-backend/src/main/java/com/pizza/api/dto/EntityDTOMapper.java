package com.pizza.api.dto;

import com.pizza.api.entity.crust.Crust;
import com.pizza.api.entity.order.CustomerOrder;
import com.pizza.api.entity.order.OrderItem;
import com.pizza.api.entity.order.OrderItemTopping;
import com.pizza.api.entity.product.Product;
import com.pizza.api.entity.product.ProductSize;
import com.pizza.api.entity.topping.Topping;
import com.pizza.api.entity.user.User;
import java.util.List;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.NullValueCheckStrategy;
import org.mapstruct.ReportingPolicy;

/**
 * The single mapper for every entity ↔ DTO conversion.
 *
 * <p>MapStruct generates the implementation at COMPILE time — open
 * {@code target/generated-sources/annotations} to read the plain Java it writes. No reflection, no
 * runtime cost, and a mapping mistake is a compile error rather than a surprise null.
 *
 * <p><b>Note {@code id <- publicId} on every mapping.</b> That one line is what keeps the numeric
 * primary key server-side: there is no path by which the BIGINT can reach a client.
 *
 * <p>Equally important is what is NOT here — no mapping produces a password hash, because
 * {@link UserDTO} has no such field. MapStruct maps by matching names, so the hash cannot leak
 * through this mapper even by accident.
 */
// @formatter:off
@Mapper(
        componentModel = "spring",
        nullValueCheckStrategy = NullValueCheckStrategy.ALWAYS,
        unmappedTargetPolicy = ReportingPolicy.IGNORE)
// @formatter:on
public interface EntityDTOMapper {

    // ---------------------------------------------------------------- product

    @Mapping(target = "id", source = "publicId")
    ProductDTO mapProductToProductDTO(Product product);

    List<ProductDTO> mapProductsToProductDTOs(List<Product> products);

    @Mapping(target = "id", source = "publicId")
    ProductSizeDTO mapProductSizeToProductSizeDTO(ProductSize size);

    /**
     * The inverse direction. Everything the server owns is ignored, because it must never be
     * settable from a request body — this is the mass-assignment guard.
     */
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "publicId", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deleted", ignore = true)
    @Mapping(target = "sizes", ignore = true)
    Product mapProductCreateDTOToProduct(ProductCreateDTO dto);

    // ---------------------------------------------------------------- topping

    @Mapping(target = "id", source = "publicId")
    ToppingDTO mapToppingToToppingDTO(Topping topping);

    List<ToppingDTO> mapToppingsToToppingDTOs(List<Topping> toppings);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "publicId", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deleted", ignore = true)
    Topping mapToppingCreateDTOToTopping(ToppingCreateDTO dto);

    // ---------------------------------------------------------------- crust

    @Mapping(target = "id", source = "publicId")
    CrustDTO mapCrustToCrustDTO(Crust crust);

    List<CrustDTO> mapCrustsToCrustDTOs(List<Crust> crusts);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "publicId", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deleted", ignore = true)
    Crust mapCrustCreateDTOToCrust(CrustCreateDTO dto);

    // ---------------------------------------------------------------- user

    @Mapping(target = "id", source = "publicId")
    UserDTO mapUserToUserDTO(User user);

    List<UserDTO> mapUsersToUserDTOs(List<User> users);

    // ---------------------------------------------------------------- order

    /**
     * {@code email} is not a column — it is either the account's address or the guest address,
     * which {@code CustomerOrder.contactEmail()} already decides. {@code expression} lets MapStruct
     * call it.
     */
    @Mapping(target = "id", source = "publicId")
    @Mapping(target = "email", expression = "java(order.contactEmail())")
    OrderDTO mapCustomerOrderToOrderDTO(CustomerOrder order);

    List<OrderDTO> mapCustomerOrdersToOrderDTOs(List<CustomerOrder> orders);

    /** Nested entities publish their UUIDs too — never the numeric keys. */
    @Mapping(target = "id", source = "publicId")
    @Mapping(target = "productId", source = "product.publicId")
    @Mapping(target = "crustId", source = "crust.publicId")
    OrderItemDTO mapOrderItemToOrderItemDTO(OrderItem item);

    @Mapping(target = "id", source = "publicId")
    @Mapping(target = "toppingId", source = "topping.publicId")
    OrderItemToppingDTO mapOrderItemToppingToOrderItemToppingDTO(OrderItemTopping topping);
}
