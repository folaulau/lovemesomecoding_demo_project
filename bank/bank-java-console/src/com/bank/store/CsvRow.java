package com.bank.store;

import com.bank.model.Money;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Function;

/**
 * One row of a CSV, addressed by column name instead of by index.
 *
 * <p>`row.getLong("user_id")` survives someone adding a column; `parts[1]` does not. The map is a
 * {@link LinkedHashMap} because it remembers insertion order, so writing the row back out produces
 * the columns in the order the header declares. A plain HashMap would scramble them.
 */
public class CsvRow {

    private final Map<String, String> values = new LinkedHashMap<>();

    public CsvRow put(String column, String value) {
        values.put(column, value);
        return this; // Returning `this` allows chaining: row.put(..).put(..) — a tiny builder.
    }

    public Map<String, String> values() {
        return values;
    }

    public String getString(String column) {
        String value = values.get(column);
        if (value == null) {
            throw new IllegalArgumentException("No column named '" + column + "' in this row");
        }
        return value;
    }

    public long getLong(String column) {
        return parse(column, Long::parseLong);
    }

    public BigDecimal getMoney(String column) {
        return parse(column, Money::of);
    }

    public LocalDateTime getTimestamp(String column) {
        return parse(column, LocalDateTime::parse);
    }

    /**
     * The shared body of every getter above.
     *
     * <p>{@code <T>} makes the method generic: the return type follows whatever the converter
     * produces. The converter is a {@link Function}, so callers can pass a method reference such as
     * {@code Long::parseLong}. Without this, each getter would repeat the same try/catch.
     */
    private <T> T parse(String column, Function<String, T> converter) {
        String raw = getString(column);
        try {
            return converter.apply(raw);
        } catch (RuntimeException e) {
            throw new IllegalArgumentException(
                    "Column '%s' holds '%s', which could not be parsed".formatted(column, raw), e);
        }
    }
}
