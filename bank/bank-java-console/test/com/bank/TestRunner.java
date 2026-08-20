package com.bank;

import java.util.ArrayList;
import java.util.List;

/**
 * A hand-rolled test runner, about sixty lines of it.
 *
 * <p>Every real project uses JUnit. This one does not, because it has no build tool and therefore no
 * way to fetch a dependency — and because seeing the whole of a test framework at once demystifies
 * the thing. JUnit does all of this and a great deal more: discovery by annotation, fixtures,
 * parameterised tests, parallel execution, an assertion library with useful failure messages.
 *
 * <p>Note {@code AutoCloseable}: {@link #close()} prints the summary and sets the exit code, so a
 * try-with-resources block in main cannot forget to report.
 */
public class TestRunner implements AutoCloseable {

    private final List<String> failures = new ArrayList<>();
    private int passed;

    /** Runs one named test. A {@link Runnable} is just "a block of code with no arguments". */
    public void test(String name, Runnable body) {
        try {
            body.run();
            passed++;
            System.out.println("  ✓ " + name);
        } catch (AssertionError | RuntimeException e) {
            // AssertionError is not a RuntimeException — both are Throwable, but neither extends
            // the other, so both have to be named. Catching plain Exception would miss every
            // failed assertion, and the suite would report all green.
            failures.add(name + " — " + e);
            System.out.println("  ✗ " + name);
            System.out.println("      " + e);
        }
    }

    public void section(String title) {
        System.out.println();
        System.out.println(title);
        System.out.println("-".repeat(title.length()));
    }

    public static void assertTrue(String message, boolean condition) {
        if (!condition) {
            throw new AssertionError(message);
        }
    }

    public static void assertEquals(String message, Object expected, Object actual) {
        // Objects.equals handles nulls on either side; expected.equals(actual) would throw.
        if (!java.util.Objects.equals(expected, actual)) {
            throw new AssertionError("%s — expected <%s> but was <%s>".formatted(message, expected, actual));
        }
    }

    /**
     * Asserts that the body throws.
     *
     * <p>The "expected exception" test is the one people skip, and it is the one that catches the
     * most: a rule that silently stops being enforced looks exactly like a passing app.
     */
    public static void assertThrows(String message, Class<? extends Throwable> expected, Runnable body) {
        try {
            body.run();
        } catch (Throwable thrown) {
            if (expected.isInstance(thrown)) {
                return; // Correct type — the test passes.
            }
            throw new AssertionError(
                    "%s — expected %s but got %s".formatted(message, expected.getSimpleName(), thrown));
        }
        throw new AssertionError(message + " — expected " + expected.getSimpleName() + ", nothing was thrown");
    }

    @Override
    public void close() {
        System.out.println();
        if (failures.isEmpty()) {
            System.out.println("All %d tests passed.".formatted(passed));
            return;
        }
        System.out.println("%d passed, %d FAILED:".formatted(passed, failures.size()));
        failures.forEach(failure -> System.out.println("  - " + failure));
        // A non-zero exit code is how CI, or `set -e` in a shell script, learns that this failed.
        System.exit(1);
    }
}
