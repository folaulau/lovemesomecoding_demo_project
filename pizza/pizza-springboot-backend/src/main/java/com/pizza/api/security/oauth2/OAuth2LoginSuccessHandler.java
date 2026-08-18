package com.pizza.api.security.oauth2;

import com.pizza.api.entity.user.User;
import com.pizza.api.entity.user.UserDAO;
import com.pizza.api.entity.user.UserRole;
import com.pizza.api.exception.ApiException;
import com.pizza.api.security.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Runs after Google has authenticated someone, and is where the interesting problem lives.
 *
 * <p>Everything up to this point is boilerplate Spring Security handles: the redirect to Google,
 * the code exchange, fetching the profile. What no framework can decide for you is <b>who this
 * person is in YOUR database</b> — and getting that wrong is how one human ends up with two
 * accounts and loses their order history.
 *
 * <h2>The reconciliation rule this app uses</h2>
 *
 * <p>Match on <b>verified</b> email. If a user row already has that address, this is the same
 * person signing in a different way, so we attach rather than create. If not, create a CUSTOMER
 * with no password hash — an account that can only ever be entered through Google.
 *
 * <p>⚠️ <b>The email must be verified by the provider.</b> Matching on an unverified address is an
 * account-takeover vulnerability: an attacker signs up to the identity provider claiming
 * {@code someone@example.com}, and if we trust that claim we hand them the existing account.
 * Google sets {@code email_verified}, and this handler refuses the login without it.
 *
 * <h2>Why it issues our own JWT rather than using the session</h2>
 *
 * <p>The rest of this API is stateless and token-based. Ending an OAuth2 login with a session
 * cookie would mean two different authentication mechanisms and two sets of rules. Instead the
 * OAuth2 flow is treated as one more way to prove identity, and the result is the same token
 * {@code /api/auth/login} issues.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OAuth2LoginSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final UserDAO userDAO;
    private final JwtService jwtService;

    @Value("${pizza.oauth2.success-redirect:http://localhost:5173/oauth2/callback}")
    private String successRedirect;

    @Override
    @Transactional
    public void onAuthenticationSuccess(
            HttpServletRequest request, HttpServletResponse response, Authentication authentication)
            throws IOException {

        OAuth2User oauthUser = (OAuth2User) authentication.getPrincipal();

        String email = oauthUser.getAttribute("email");
        Boolean emailVerified = oauthUser.getAttribute("email_verified");
        String name = oauthUser.getAttribute("name");

        if (email == null || email.isBlank()) {
            throw ApiException.unauthorized("The identity provider returned no email address");
        }
        if (!Boolean.TRUE.equals(emailVerified)) {
            // See the class comment. This check is the difference between "sign in with Google"
            // and "let anyone claim any account".
            log.warn("Refused an OAuth2 login for unverified address {}", email);
            throw ApiException.unauthorized("Your email address is not verified with the provider");
        }

        User user = userDAO.findByEmail(email).orElseGet(() -> createFromOAuth(email, name));

        // Our token, our claims, our expiry — identical to a password login from here on.
        String token = jwtService.generateToken(user);

        // The token goes in the URL fragment, NOT the query string: a fragment is never sent to the
        // server, never lands in an access log and is not sent as a Referer. A query parameter
        // would leak the token into every one of those.
        String target = successRedirect + "#token=" + URLEncoder.encode(token, StandardCharsets.UTF_8);

        log.info("OAuth2 login succeeded for {}", email);
        getRedirectStrategy().sendRedirect(request, response, target);
    }

    /**
     * Creates the account for a first-time Google user.
     *
     * <p>{@code passwordHash} is left null on purpose, and every password-checking path must treat
     * null as "no password login available" rather than as an empty password. The role is always
     * CUSTOMER — exactly as in {@code /api/auth/register}, because a role that can be influenced
     * from outside is a privilege-escalation bug waiting to happen.
     */
    private User createFromOAuth(String email, String name) {
        log.info("First OAuth2 login for {} — creating a customer account", email);
        return userDAO.save(User.builder()
                .email(email)
                .fullName(name == null || name.isBlank() ? email : name)
                .passwordHash(null)
                .role(UserRole.CUSTOMER)
                .build());
    }
}
