package com.bank.store;

import com.bank.model.Account;
import com.bank.model.AccountType;
import com.bank.model.Money;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;

/** accounts.csv. */
public class AccountStore extends CsvStore<Account> {

    static final List<String> HEADER = List.of("id", "user_id", "type", "number", "balance");

    public AccountStore(Path dataDir) {
        super(dataDir.resolve("accounts.csv"), HEADER);
    }

    @Override
    protected Account fromRow(CsvRow row) {
        return new Account(
                row.getLong("id"),
                row.getLong("user_id"),
                AccountType.fromCsv(row.getString("type")),
                row.getString("number"),
                row.getMoney("balance"));
    }

    @Override
    protected CsvRow toRow(Account account) {
        return new CsvRow()
                .put("id", String.valueOf(account.id()))
                .put("user_id", String.valueOf(account.userId()))
                .put("type", account.type().name())
                .put("number", account.number())
                .put("balance", Money.toCsv(account.balance()));
    }

    @Override
    protected long idOf(Account account) {
        return account.id();
    }

    /** This customer's accounts, CHECKING before SAVINGS so the menu numbering is stable. */
    public List<Account> findByUser(long userId) {
        return sorted(
                find(account -> account.userId() == userId),
                // Comparator.comparing takes "how to get the sort key" and builds the comparator.
                // thenComparing chains a tiebreaker. Enums sort by declaration order.
                Comparator.comparing(Account::type).thenComparing(Account::id));
    }
}
