package com.bank.error;

/**
 * The base of this app's own exceptions.
 *
 * <p>It extends RuntimeException (unchecked) rather than Exception (checked) on purpose. Checked
 * exceptions force every caller in the chain to declare `throws`, and for "the user typed something
 * invalid" that noise buys nothing — one try/catch at the menu loop handles them all. Checked
 * exceptions earn their keep when the caller can plausibly recover; here, only the top level can.
 *
 * <p>A shared base class is what makes that single catch possible: `catch (BankException e)` catches
 * every subclass below.
 */
public class BankException extends RuntimeException {

    public BankException(String message) {
        super(message);
    }

    public BankException(String message, Throwable cause) {
        // Always pass the cause along. Dropping it is how a stack trace loses the line that
        // actually broke.
        super(message, cause);
    }
}
