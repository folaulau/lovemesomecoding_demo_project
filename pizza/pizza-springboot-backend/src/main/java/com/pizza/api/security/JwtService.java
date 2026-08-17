package com.pizza.api.security;

import com.pizza.api.entity.user.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Issues and verifies JSON Web Tokens.
 *
 * <p>A JWT is signed, not encrypted: anyone holding one can read its payload. Never put anything
 * secret in the claims. The signature only guarantees that WE issued it and nobody edited it.
 *
 * <p>Tokens are stateless — there is no server-side session to look up, which is what lets the
 * same token work for the React app, the Angular app and Swagger alike. The trade-off is that a
 * token cannot be revoked before it expires; real systems add a short lifetime plus a refresh
 * token, which is deliberately out of scope here.
 */
@Service
public class JwtService {

    private static final String CLAIM_ROLE = "role";
    private static final String CLAIM_USER_ID = "uid";

    @Value("${pizza.jwt.secret}")
    private String secret;

    @Value("${pizza.jwt.expiration-minutes}")
    private long expirationMinutes;

    private SecretKey key;

    @PostConstruct
    void init() {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        // HS256 requires at least 256 bits. Failing loudly at startup beats discovering a weak
        // key in production.
        if (keyBytes.length < 32) {
            throw new IllegalStateException(
                    "pizza.jwt.secret must be at least 32 characters for HS256 (got " + keyBytes.length + ")");
        }
        this.key = Keys.hmacShaKeyFor(keyBytes);
    }

    public String generateToken(User user) {
        Instant now = Instant.now();
        Instant expiry = now.plusSeconds(expirationMinutes * 60);

        return Jwts.builder()
                .subject(user.getEmail())
                .claim(CLAIM_ROLE, user.getRole().name())
                .claim(CLAIM_USER_ID, user.getId())
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                .signWith(key)
                .compact();
    }

    /** Returns the claims if the token is valid, or null if it is malformed, forged or expired. */
    public Claims parse(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (JwtException | IllegalArgumentException ex) {
            // Any failure means "not authenticated". Distinguishing them would only help an
            // attacker probe the implementation.
            return null;
        }
    }

    public long getExpirationMinutes() {
        return expirationMinutes;
    }
}
