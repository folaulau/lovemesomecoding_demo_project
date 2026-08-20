package com.bank.error;

/**
 * Sign-in failed.
 *
 * <p>The message is deliberately vague — "Invalid email or password" rather than "no such email".
 * Saying which half was wrong tells an attacker which email addresses are real accounts.
 */
public class AuthenticationException extends BankException {

    public AuthenticationException(String message) {
        super(message);
    }
}
