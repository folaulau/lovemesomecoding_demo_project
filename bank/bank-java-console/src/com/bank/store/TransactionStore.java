package com.bank.store;

import com.bank.model.Money;
import com.bank.model.Transaction;
import com.bank.model.TransactionType;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;

/** transactions.csv — append-only in practice: a statement line is never edited. */
public class TransactionStore extends CsvStore<Transaction> {

    static final List<String> HEADER =
            List.of("id", "account_id", "type", "amount", "balance_after", "timestamp", "description");

    public TransactionStore(Path dataDir) {
        super(dataDir.resolve("transactions.csv"), HEADER);
    }

    @Override
    protected Transaction fromRow(CsvRow row) {
        return new Transaction(
                row.getLong("id"),
                row.getLong("account_id"),
                TransactionType.fromCsv(row.getString("type")),
                row.getMoney("amount"),
                row.getMoney("balance_after"),
                row.getTimestamp("timestamp"),
                row.getString("description"));
    }

    @Override
    protected CsvRow toRow(Transaction transaction) {
        return new CsvRow()
                .put("id", String.valueOf(transaction.id()))
                .put("account_id", String.valueOf(transaction.accountId()))
                .put("type", transaction.type().name())
                .put("amount", Money.toCsv(transaction.amount()))
                .put("balance_after", Money.toCsv(transaction.balanceAfter()))
                .put("timestamp", transaction.timestamp().toString())
                .put("description", transaction.description());
    }

    @Override
    protected long idOf(Transaction transaction) {
        return transaction.id();
    }

    /** The statement for one account, newest first, at most {@code limit} lines. */
    public List<Transaction> findByAccount(long accountId, int limit) {
        return find(transaction -> transaction.accountId() == accountId).stream()
                .sorted(Comparator.comparing(Transaction::timestamp).reversed())
                .limit(limit) // Streams are lazy: only `limit` items are ever built into the result.
                .toList();
    }

    /** Appends several rows in one rewrite of the file, which is what a transfer needs. */
    public void addAll(List<Transaction> transactions) {
        List<Transaction> all = new java.util.ArrayList<>(findAll());
        all.addAll(transactions);
        saveAll(all);
    }
}
