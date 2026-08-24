package com.reelcms.api.security;

import com.reelcms.api.entity.user.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import javax.crypto.SecretKey;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Issues and verifies the JWTs the admin UI signs in with. */
@Slf4j
@Service
public class JwtService {

    private final SecretKey key;
    private final Duration ttl;

    public JwtService(@Value("${reelcms.jwt.secret}") String secret, @Value("${reelcms.jwt.ttl-hours}") long ttlHours) {
        // HS256 requires a key of at least 256 bits. A shorter secret throws
        // WeakKeyException at STARTUP rather than at first login, which is the right
        // time to find out - but the message does not mention application.properties,
        // so it is worth knowing that is where to look.
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.ttl = Duration.ofHours(ttlHours);
    }

    public String issue(User user) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(user.getId())
                .claim("email", user.getEmail())
                .claim("roles", user.getRoles())
                .claim("creatorId", user.getCreatorId())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ttl)))
                .signWith(key)
                .compact();
    }

    /** Returns null rather than throwing: an invalid token is an expected condition, not an error. */
    public Claims parse(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (Exception ex) {
            log.debug("Rejected token: {}", ex.getMessage());
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    public List<String> rolesOf(Claims claims) {
        Object raw = claims.get("roles");
        return raw instanceof List<?> list ? (List<String>) list : List.of();
    }
}
