package com.bank.ui;

import com.bank.model.Money;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;

/**
 * Reading from and writing to the terminal — the only class in the app that touches System.in or
 * System.out.
 *
 * <p>A {@link BufferedReader} rather than a Scanner, for one practical reason: Scanner's mix of
 * nextInt() and nextLine() leaves the newline in the buffer and the next read comes back empty.
 * Reading whole lines and parsing them afterwards avoids the trap entirely, and it means piping a
 * script of answers into the app (which is how the end-to-end test drives it) behaves the same as
 * a human typing.
 */
public class Console {

    private final BufferedReader reader =
            new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));

    public void print(String text) {
        System.out.println(text);
    }

    public void blank() {
        System.out.println();
    }

    /** A heading with a rule under it, sized to the text. */
    public void heading(String text) {
        System.out.println();
        System.out.println(text);
        // "=".repeat(n) — Java 11+. Building the same string with a loop is four lines for nothing.
        System.out.println("=".repeat(text.length()));
    }

    public void error(String message) {
        System.out.println("  ⚠  " + message);
    }

    public void success(String message) {
        System.out.println("  ✓  " + message);
    }

    /**
     * Prompts, then returns the answer.
     *
     * @return the trimmed line, or {@code null} when input has run out — Ctrl-D, or the end of a
     *     piped script. Returning null here is deliberate: "there is no more input" is genuinely a
     *     different thing from "the user pressed enter on an empty line", and callers must handle
     *     it or the menu loops forever.
     */
    public String readLine(String prompt) {
        System.out.print(prompt);
        System.out.flush(); // print() does not flush, and without this the prompt appears late.
        try {
            String line = reader.readLine();
            return line == null ? null : line.trim();
        } catch (IOException e) {
            throw new UncheckedIOException("Could not read from the terminal", e);
        }
    }

    /**
     * Keeps asking until the answer is a whole number in range.
     *
     * <p>The "loop until valid" shape is the heart of every console app. Note that it returns
     * {@code fallback} at end of input, so a piped script that runs out does not spin forever.
     */
    public int readChoice(String prompt, int min, int max, int fallback) {
        while (true) {
            String input = readLine(prompt);
            if (input == null) {
                return fallback;
            }
            try {
                int value = Integer.parseInt(input);
                if (value < min || value > max) {
                    error("Enter a number between %d and %d.".formatted(min, max));
                    continue;
                }
                return value;
            } catch (NumberFormatException e) {
                // Catching the exception is the validation. Java has no "is this parseable" check
                // that does not amount to parsing it.
                error("'%s' is not a number.".formatted(input));
            }
        }
    }

    /** Keeps asking until the answer is an amount of money. Returns null at end of input. */
    public BigDecimal readAmount(String prompt) {
        while (true) {
            String input = readLine(prompt);
            if (input == null) {
                return null;
            }
            try {
                return Money.parse(input);
            } catch (NumberFormatException e) {
                error("'%s' is not an amount. Try something like 25.50".formatted(input));
            }
        }
    }
}
