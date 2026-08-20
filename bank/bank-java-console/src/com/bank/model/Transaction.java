package com.bank.model;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * One line on a statement. A record again: once money has moved, the history of it never changes.
 *
 * <p>`balanceAfter` is stored rather than recalculated. Real ledgers do this too — it makes each
 * row independently meaningful, and it is how you notice later that a balance drifted.
 */
public record Transaction(
        long id,
        long accountId,
        TransactionType type,
        BigDecimal amount,
        BigDecimal balanceAfter,
        LocalDateTime timestamp,
        String description) {

    private static final DateTimeFormatter DISPLAY = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    /** The amount as it should read on a statement: negative for withdrawals. */
    public BigDecimal signedAmount() {
        return type.signed(amount);
    }

    /** One statement line, column-aligned. `%-12s` left-aligns in 12 characters, `%12s` right. */
    public String toStatementLine() {
        return "%-16s  %-14s  %12s  %14s  %s"
                .formatted(
                        timestamp.format(DISPLAY),
                        type.label(),
                        Money.format(signedAmount()),
                        Money.format(balanceAfter),
                        description);
    }
}
