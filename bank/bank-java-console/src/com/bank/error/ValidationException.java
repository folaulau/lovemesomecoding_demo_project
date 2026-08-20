package com.bank.error;

/** The request was well-formed but broke a rule — a negative deposit, a transfer to the same account. */
public class ValidationException extends BankException {

    public ValidationException(String message) {
        super(message);
    }
}
