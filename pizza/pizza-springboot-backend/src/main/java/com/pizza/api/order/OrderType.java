package com.pizza.api.order;

/**
 * Delivery or carryout.
 *
 * <p>This only decides whether an address is required and whether the delivery fee applies. There
 * is no store-routing logic behind it — deliberately out of scope for this demo.
 */
public enum OrderType {
    DELIVERY,
    CARRYOUT
}
