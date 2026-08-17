package com.pizza.api.user;

/**
 * Two roles is all this demo needs.
 *
 * <p>Spring Security expects authorities prefixed with {@code ROLE_}; the prefix is added when the
 * token is built rather than stored in the database, so the column stays readable.
 */
public enum UserRole {
    CUSTOMER,
    ADMIN
}
