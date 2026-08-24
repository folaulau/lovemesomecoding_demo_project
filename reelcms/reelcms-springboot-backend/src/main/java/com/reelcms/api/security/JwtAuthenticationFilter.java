package com.reelcms.api.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

/** Reads the bearer token (or, for SSE, the `token` query parameter) and populates the context. */
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwt;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request, @NonNull HttpServletResponse response, @NonNull FilterChain chain)
            throws ServletException, IOException {

        String token = extractToken(request);
        if (StringUtils.hasText(token)) {
            Claims claims = jwt.parse(token);
            if (claims != null) {
                List<String> roles = jwt.rolesOf(claims);
                var principal = new AuthPrincipal(
                        claims.getSubject(),
                        claims.get("email", String.class),
                        roles,
                        claims.get("creatorId", String.class));
                // Spring Security expects the ROLE_ prefix for hasRole(); leaving it off
                // makes hasRole("ADMIN") silently never match while hasAuthority("ADMIN")
                // works, which is a confusing pair of behaviours to debug.
                var authorities = roles.stream()
                        .map(r -> new SimpleGrantedAuthority("ROLE_" + r))
                        .toList();
                var auth = new UsernamePasswordAuthenticationToken(principal, null, authorities);
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
        }
        chain.doFilter(request, response);
    }

    private String extractToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (StringUtils.hasText(header) && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        // EventSource cannot set request headers - a browser API limitation, not an
        // oversight - so the SSE endpoint accepts the token as a query parameter. This
        // is scoped to that one path on purpose: a token in a URL ends up in access
        // logs and Referer headers, so it should never be the general mechanism.
        if (request.getRequestURI().startsWith("/api/admin/stream/")) {
            return request.getParameter("token");
        }
        return null;
    }
}
