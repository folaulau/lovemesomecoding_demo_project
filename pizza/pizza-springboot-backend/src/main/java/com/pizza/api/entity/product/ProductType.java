package com.pizza.api.entity.product;

/**
 * Pizzas and drinks live in the same table and are separated by this discriminator.
 *
 * <p>Two entity classes would also work, but for a menu this small a single table with a type
 * column keeps queries and the admin CRUD screens simple.
 */
public enum ProductType {
    PIZZA,
    DRINK
}
