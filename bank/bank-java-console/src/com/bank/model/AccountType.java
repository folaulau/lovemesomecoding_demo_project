package com.bank.model;

/**
 * A fixed set of named values — the textbook case for an enum.
 *
 * <p>Storing "CHECKING" as a plain String would compile just as happily, but then a typo like
 * "CHEKING" only fails at runtime. An enum makes the compiler check it for us, and gives each
 * constant somewhere to hang data (the label) and behaviour (fromCsv).
 */
public enum AccountType {
    CHECKING("Checking"),
    SAVINGS("Savings");

    // Enum constants can carry fields. `final` because a type's label never changes.
    private final String label;

    // The constructor is implicitly private — only the constants above can call it.
    AccountType(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    /** Parses the value stored in accounts.csv, with a clear message when the file is wrong. */
    public static AccountType fromCsv(String value) {
        try {
            return AccountType.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            // Re-thrown with context: valueOf's own message is just the bad string on its own.
            throw new IllegalArgumentException("Unknown account type in CSV: " + value, e);
        }
    }
}
