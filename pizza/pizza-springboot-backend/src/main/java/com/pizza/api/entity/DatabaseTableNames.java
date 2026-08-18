package com.pizza.api.entity;

/**
 * Every table name in one place.
 *
 * <p>An interface used purely as a constant holder: entities reference
 * {@code @Table(name = DatabaseTableNames.PRODUCT)} rather than a loose string, so a rename is a
 * single edit and a typo is a compile error instead of a runtime "table doesn't exist".
 */
public interface DatabaseTableNames {

    String PRODUCT = "product";
    String PRODUCT_SIZE = "product_size";
    String CRUST = "crust";
    String TOPPING = "topping";
    String USER = "app_user";
    String CUSTOMER_ORDER = "customer_order";
    String ORDER_ITEM = "order_item";
    String ORDER_ITEM_TOPPING = "order_item_topping";
    String CART = "cart";
    String CART_ITEM = "cart_item";
    String CART_ITEM_TOPPING = "cart_item_topping";
    String USER_ADDRESS = "user_address";
    String USER_PAYMENT_METHOD = "user_payment_method";
}
