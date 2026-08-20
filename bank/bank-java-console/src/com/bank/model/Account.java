package com.bank.model;

import java.math.BigDecimal;

/**
 * A single account belonging to a user.
 *
 * <p>Not a record, unlike {@link User} and {@link Transaction}: the balance changes, and a record's
 * fields are final. This is the ordinary "class with private fields and getters" shape — and the
 * balance has no public setter, so the only way to move money is through {@link #credit} and
 * {@link #debit}, which enforce the rules. That is encapsulation doing real work rather than
 * ceremony: an outside caller cannot set a negative balance because it cannot reach the field.
 */
public class Account {

    private final long id;
    private final long userId;
    private final AccountType type;
    private final String number;
    private BigDecimal balance;

    public Account(long id, long userId, AccountType type, String number, BigDecimal balance) {
        this.id = id;
        this.userId = userId;
        this.type = type;
        this.number = number;
        this.balance = Money.round(balance);
    }

    public long id() {
        return id;
    }

    public long userId() {
        return userId;
    }

    public AccountType type() {
        return type;
    }

    public String number() {
        return number;
    }

    public BigDecimal balance() {
        return balance;
    }

    /** Adds money. Package-visible rules live in the service; this only guards the invariant. */
    public void credit(BigDecimal amount) {
        requirePositive(amount);
        balance = Money.round(balance.add(amount));
    }

    /**
     * Removes money.
     *
     * @throws IllegalStateException if the account cannot cover it — the service checks first and
     *     raises a friendly InsufficientFundsException, so reaching this means a caller skipped it
     */
    public void debit(BigDecimal amount) {
        requirePositive(amount);
        if (balance.compareTo(amount) < 0) {
            throw new IllegalStateException("Balance cannot go negative");
        }
        balance = Money.round(balance.subtract(amount));
    }

    public boolean canCover(BigDecimal amount) {
        return balance.compareTo(amount) >= 0;
    }

    private void requirePositive(BigDecimal amount) {
        if (!Money.isPositive(amount)) {
            throw new IllegalArgumentException("Amount must be greater than zero");
        }
    }

    /**
     * "Checking (1001-0001) — $1,250.00".
     *
     * <p>A record would generate a toString for us; a plain class has to write one, and it is
     * worth writing — the default is `com.bank.model.Account@6d06d69c`, which helps nobody.
     */
    @Override
    public String toString() {
        return "%s (%s) — %s".formatted(type.label(), number, Money.format(balance));
    }
}
