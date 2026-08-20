package com.bank.store;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.function.Predicate;
import java.util.stream.Collectors;

/**
 * The shared behaviour of every store, written once.
 *
 * <p>{@code <T>} is a type parameter: {@code CsvStore<User>} returns Users, {@code CsvStore<Account>}
 * returns Accounts, and the compiler checks it — no casting, no Object. This is the payoff of
 * generics: one implementation of findAll/find/save, not three.
 *
 * <p>The class is `abstract` because it cannot know how to turn a row into a T. The two abstract
 * methods are the holes each subclass fills — the template-method pattern, and the reason DAO
 * layers in bigger apps look the way they do.
 */
public abstract class CsvStore<T> {

    protected final CsvTable table;

    protected CsvStore(Path file, List<String> header) {
        this.table = new CsvTable(file, header);
    }

    /** Row → object. Implemented by each subclass. */
    protected abstract T fromRow(CsvRow row);

    /** Object → row. The exact inverse of fromRow; if they disagree, data is lost on save. */
    protected abstract CsvRow toRow(T item);

    /** Every record's id, so this class can work out the next one. */
    protected abstract long idOf(T item);

    public List<T> findAll() {
        // A stream: map each row through fromRow, collect the results into a List.
        // The loop version is three more lines and reads no better once you know this shape.
        return table.readAll().stream().map(this::fromRow).collect(Collectors.toList());
    }

    /**
     * Every record matching the test.
     *
     * <p>{@link Predicate} is "a function that answers yes or no", so callers pass a lambda:
     * {@code find(account -> account.userId() == 1)}.
     */
    public List<T> find(Predicate<T> test) {
        return findAll().stream().filter(test).collect(Collectors.toList());
    }

    /**
     * The first match, if there is one.
     *
     * <p>{@link Optional} instead of returning null: the caller cannot forget the "not found" case,
     * because they have to unwrap it. That is one whole category of NullPointerException gone.
     */
    public Optional<T> findFirst(Predicate<T> test) {
        return findAll().stream().filter(test).findFirst();
    }

    public Optional<T> findById(long id) {
        return findFirst(item -> idOf(item) == id);
    }

    /** Writes the given list out, replacing everything currently in the file. */
    public void saveAll(List<T> items) {
        table.writeAll(items.stream().map(this::toRow).collect(Collectors.toList()));
    }

    /** Appends one record. */
    public void add(T item) {
        List<T> all = new ArrayList<>(findAll()); // findAll may be immutable — copy before adding.
        all.add(item);
        saveAll(all);
    }

    /**
     * The next free id.
     *
     * <p>A database does this with an auto-increment column. Doing it by hand is fine for one
     * process; two copies of the app running at once would both read the same max and collide.
     * That race is exactly what a database's sequence exists to prevent.
     */
    public long nextId() {
        return findAll().stream().mapToLong(this::idOf).max().orElse(0L) + 1;
    }

    /** Convenience for the common "newest first" sort. */
    protected static <E> List<E> sorted(List<E> items, Comparator<E> comparator) {
        return items.stream().sorted(comparator).collect(Collectors.toList());
    }
}
