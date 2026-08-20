package com.bank.service;

import com.bank.error.AuthenticationException;
import com.bank.model.User;
import com.bank.store.UserStore;
import java.util.Optional;

/**
 * Sign-in.
 *
 * <p>Small enough to fold into the menu, kept separate anyway: the menu's job is reading and
 * printing, this one's is deciding. Split that way, the rule can be tested without a keyboard.
 */
public class AuthService {

    private final UserStore userStore;

    /**
     * The store arrives through the constructor rather than being created here.
     *
     * <p>That is dependency injection, in its plainest form — no framework required. It is why the
     * tests can hand this class a store pointed at a temp directory.
     */
    public AuthService(UserStore userStore) {
        this.userStore = userStore;
    }

    /**
     * @throws AuthenticationException when the email is unknown <em>or</em> the password is wrong —
     *     one message for both, on purpose. See {@link AuthenticationException}.
     */
    public User signIn(String email, String password) {
        Optional<User> found = userStore.findByEmail(email);

        // The whole check reads as one expression: present, and the password matches.
        // Optional.filter keeps the value only if the test passes, so an unknown email and a wrong
        // password both arrive at the same empty Optional — no branch, and no way to leak which.
        return found.filter(user -> user.passwordMatches(password == null ? "" : password))
                .orElseThrow(() -> new AuthenticationException("Invalid email or password."));
    }
}
