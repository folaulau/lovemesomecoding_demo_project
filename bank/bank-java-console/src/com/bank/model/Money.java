package com.bank.model;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.util.Locale;

/**
 * Money helpers, kept in one place.
 *
 * <p><b>Never use double for money.</b> `0.1 + 0.2` is `0.30000000000000004` in binary floating
 * point, and a bank that loses a hundredth of a cent per transaction is a bank with a bug. Java's
 * answer is {@link BigDecimal}: exact decimal arithmetic, at the cost of method calls instead of
 * operators (`a.add(b)`, not `a + b`).
 *
 * <p>The class is `final` with a private constructor — the classic way to say "this is a bag of
 * static utilities, do not instantiate or extend it".
 */
public final class Money {

    public static final BigDecimal ZERO = of("0");

    /** Two decimal places, the way currency is written. */
    private static final int SCALE = 2;

    private Money() {
        // Utility class: nothing to construct.
    }

    /**
     * Builds a BigDecimal from a string.
     *
     * <p>Always construct from a String, never `new BigDecimal(0.1)` — the double is already
     * imprecise before BigDecimal ever sees it, so you get 0.1000000000000000055511151231257827.
     */
    public static BigDecimal of(String value) {
        return new BigDecimal(value).setScale(SCALE, RoundingMode.HALF_UP);
    }

    /** Rounds to cents. HALF_UP is what people expect: 2.345 becomes 2.35. */
    public static BigDecimal round(BigDecimal value) {
        return value.setScale(SCALE, RoundingMode.HALF_UP);
    }

    /**
     * Parses user input, tolerating "$1,200.50" as well as "1200.5".
     *
     * @throws NumberFormatException when the text is not a number at all
     */
    public static BigDecimal parse(String input) {
        String cleaned = input.trim().replace("$", "").replace(",", "");
        if (cleaned.isEmpty()) {
            throw new NumberFormatException("No amount entered");
        }
        return round(new BigDecimal(cleaned));
    }

    /** "$1,250.00" — formatting belongs at the edge, next to the screen, not in the model. */
    public static String format(BigDecimal value) {
        return NumberFormat.getCurrencyInstance(Locale.US).format(value);
    }

    /**
     * The plain "1250.00" form written to CSV.
     *
     * <p>toPlainString, not toString: BigDecimal.toString can produce scientific notation
     * ("1.25E+3") for some values, and that is not something the file should ever contain.
     */
    public static String toCsv(BigDecimal value) {
        return round(value).toPlainString();
    }

    public static boolean isPositive(BigDecimal value) {
        // compareTo, never equals: BigDecimal.equals("1.0", "1.00") is false because it compares
        // scale as well as value. This trips up almost everyone once.
        return value.compareTo(BigDecimal.ZERO) > 0;
    }
}
