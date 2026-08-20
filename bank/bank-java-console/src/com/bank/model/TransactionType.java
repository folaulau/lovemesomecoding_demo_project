package com.bank.model;

import java.math.BigDecimal;

/** Every way money can move in this bank. */
public enum TransactionType {
    DEPOSIT("Deposit", true),
    WITHDRAWAL("Withdrawal", false),
    TRANSFER_IN("Transfer in", true),
    TRANSFER_OUT("Transfer out", false);

    private final String label;
    private final boolean credit;

    TransactionType(String label, boolean credit) {
        this.label = label;
        this.credit = credit;
    }

    public String label() {
        return label;
    }

    /** True when this kind of transaction increases the balance. */
    public boolean isCredit() {
        return credit;
    }

    /**
     * Returns the amount signed the way a bank statement shows it: -25.00 for a withdrawal.
     * Behaviour on the enum keeps every caller from re-writing the same if/else.
     */
    public BigDecimal signed(BigDecimal amount) {
        return credit ? amount : amount.negate();
    }

    public static TransactionType fromCsv(String value) {
        try {
            return TransactionType.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Unknown transaction type in CSV: " + value, e);
        }
    }
}
