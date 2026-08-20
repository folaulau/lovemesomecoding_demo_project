package com.bank.error;

import com.bank.model.Money;
import java.math.BigDecimal;

/**
 * Not enough money in the account.
 *
 * <p>A distinct class rather than a generic BankException with a different string, because callers
 * may want to treat this one specially, and because the extra fields let the message be built once
 * here instead of at every throw site.
 */
public class InsufficientFundsException extends BankException {

    private final BigDecimal requested;
    private final BigDecimal available;

    public InsufficientFundsException(BigDecimal requested, BigDecimal available) {
        super("Insufficient funds: you asked for %s but only %s is available."
                .formatted(Money.format(requested), Money.format(available)));
        this.requested = requested;
        this.available = available;
    }

    public BigDecimal requested() {
        return requested;
    }

    public BigDecimal available() {
        return available;
    }

    /** How much short the account is — the sort of thing a UI likes to show. */
    public BigDecimal shortfall() {
        return requested.subtract(available);
    }
}
