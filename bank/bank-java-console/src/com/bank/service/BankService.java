package com.bank.service;

import com.bank.error.ValidationException;
import com.bank.error.InsufficientFundsException;
import com.bank.model.Account;
import com.bank.model.Money;
import com.bank.model.Transaction;
import com.bank.model.TransactionType;
import com.bank.model.User;
import com.bank.store.AccountStore;
import com.bank.store.TransactionStore;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Every rule about moving money, in one class.
 *
 * <p>The console never adjusts a balance itself — it collects input and calls a method here. Keeping
 * the rules off the screen is what makes them testable, and it is the difference between an app you
 * can add a second interface to (a web UI, an API) and one you cannot.
 */
public class BankService {

    /** A cap, so a fat-fingered extra zero is caught rather than deposited. */
    private static final BigDecimal MAX_TRANSACTION = Money.of("50000.00");

    private final AccountStore accountStore;
    private final TransactionStore transactionStore;

    public BankService(AccountStore accountStore, TransactionStore transactionStore) {
        this.accountStore = accountStore;
        this.transactionStore = transactionStore;
    }

    public List<Account> accountsOf(User user) {
        return accountStore.findByUser(user.id());
    }

    public List<Transaction> statement(Account account, int limit) {
        return transactionStore.findByAccount(account.id(), limit);
    }

    /** The customer's total across all their accounts. */
    public BigDecimal totalBalance(User user) {
        return accountsOf(user).stream()
                .map(Account::balance)
                // reduce folds the list into one value: start at zero, add each balance.
                // BigDecimal::add is a method reference standing in for (a, b) -> a.add(b).
                .reduce(Money.ZERO, BigDecimal::add);
    }

    /** Pays money in. Returns the resulting statement line. */
    public Transaction deposit(Account account, BigDecimal amount, String description) {
        validateAmount(amount);
        List<Account> all = accountStore.findAll();
        Account live = locate(all, account.id());

        live.credit(amount);
        Transaction record = record(live, TransactionType.DEPOSIT, amount, description);

        accountStore.saveAll(all);
        transactionStore.add(record);
        return record;
    }

    /** Takes money out, refusing to overdraw. */
    public Transaction withdraw(Account account, BigDecimal amount, String description) {
        validateAmount(amount);
        List<Account> all = accountStore.findAll();
        Account live = locate(all, account.id());

        // Check before mutating. Account.debit throws too, but this produces the message the
        // customer should see, with both figures in it.
        if (!live.canCover(amount)) {
            throw new InsufficientFundsException(amount, live.balance());
        }

        live.debit(amount);
        Transaction record = record(live, TransactionType.WITHDRAWAL, amount, description);

        accountStore.saveAll(all);
        transactionStore.add(record);
        return record;
    }

    /**
     * Moves money between two of the same customer's accounts.
     *
     * <p>Both balances are changed in the in-memory list and the list is saved <b>once</b>. Two
     * separate saves would leave the money nowhere at all if the process died between them. A real
     * database wraps this in a transaction; a single rewrite of one file is the closest this app
     * can get, and it is worth noticing that the problem is the same problem.
     */
    public List<Transaction> transfer(Account from, Account to, BigDecimal amount) {
        validateAmount(amount);
        if (from.id() == to.id()) {
            throw new ValidationException("Choose two different accounts.");
        }
        if (from.userId() != to.userId()) {
            // Belt and braces: the menu only ever offers the signed-in customer's own accounts.
            throw new ValidationException("You can only transfer between your own accounts.");
        }

        List<Account> all = accountStore.findAll();
        Account source = locate(all, from.id());
        Account target = locate(all, to.id());

        if (!source.canCover(amount)) {
            throw new InsufficientFundsException(amount, source.balance());
        }

        source.debit(amount);
        target.credit(amount);

        List<Transaction> records = new ArrayList<>();
        long nextId = transactionStore.nextId();
        LocalDateTime now = LocalDateTime.now();
        records.add(new Transaction(
                nextId,
                source.id(),
                TransactionType.TRANSFER_OUT,
                amount,
                source.balance(),
                now,
                "To " + target.number()));
        records.add(new Transaction(
                nextId + 1,
                target.id(),
                TransactionType.TRANSFER_IN,
                amount,
                target.balance(),
                now,
                "From " + source.number()));

        accountStore.saveAll(all);
        transactionStore.addAll(records);
        return records;
    }

    /** Re-reads one account, so a caller holding a stale copy still sees the new balance. */
    public Account refresh(Account account) {
        return accountStore
                .findById(account.id())
                .orElseThrow(() -> new ValidationException("That account no longer exists."));
    }

    private Transaction record(
            Account account, TransactionType type, BigDecimal amount, String description) {
        return new Transaction(
                transactionStore.nextId(),
                account.id(),
                type,
                amount,
                account.balance(),
                LocalDateTime.now(),
                description == null || description.isBlank() ? type.label() : description.trim());
    }

    /**
     * Finds the account inside the freshly-loaded list.
     *
     * <p>The Account the menu is holding was read from disk earlier and is a different object. Fail
     * to do this and you mutate the stale copy, save the list you loaded, and the change vanishes —
     * a bug that looks like "the app forgets my deposit" and is genuinely hard to spot.
     */
    private Account locate(List<Account> accounts, long id) {
        return accounts.stream()
                .filter(candidate -> candidate.id() == id)
                .findFirst()
                .orElseThrow(() -> new ValidationException("That account no longer exists."));
    }

    private void validateAmount(BigDecimal amount) {
        if (amount == null || !Money.isPositive(amount)) {
            throw new ValidationException("Amount must be greater than zero.");
        }
        if (amount.compareTo(MAX_TRANSACTION) > 0) {
            throw new ValidationException(
                    "Amount is above the %s per-transaction limit.".formatted(Money.format(MAX_TRANSACTION)));
        }
    }
}
