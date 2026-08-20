package com.bank.model;

import java.time.LocalDateTime;

/**
 * A customer.
 *
 * <p>A `record` (Java 16+) for a class whose whole job is to hold values: the constructor,
 * accessors, equals, hashCode and toString are all generated. Records are immutable, which is
 * exactly right here — nothing in this app edits a user after loading them.
 *
 * <p>Note the accessors are `user.email()`, not `user.getEmail()`.
 */
public record User(long id, String email, String password, String fullName, LocalDateTime createdAt) {

    /**
     * A compact constructor: validation only, no assignment — the generated constructor still
     * assigns the fields afterwards. It runs for every User ever built, so an invalid one
     * cannot exist.
     */
    public User {
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("A user must have an email");
        }
        email = email.trim().toLowerCase(); // Normalise once, here, so sign-in never worries about it.
    }

    /** "Alice" — the first word of the name, for greeting the customer. */
    public String firstName() {
        return fullName.split(" ")[0];
    }

    /**
     * ⚠️ Plaintext comparison, deliberately, because this is a teaching fixture with throwaway
     * data. Real software never stores a password it can read back: it stores a slow salted hash
     * (bcrypt or argon2) and compares hashes. If you copy one method out of this project into
     * something real, do not let it be this one.
     */
    public boolean passwordMatches(String attempt) {
        return password.equals(attempt);
    }
}
