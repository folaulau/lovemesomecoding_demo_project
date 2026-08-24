package com.reelcms.api.config;

import com.reelcms.api.security.JwtAuthenticationFilter;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtFilter;

    @Value("${reelcms.cors.allowed-origins}")
    private String[] allowedOrigins;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.cors(cors -> cors.configurationSource(corsSource()))
                // CSRF protection defends a COOKIE-authenticated session, because the
                // browser attaches cookies automatically. A bearer token has to be added
                // by script, so a cross-site form post cannot forge one and the token is
                // itself the CSRF defence. Disabling it here is correct; it would NOT be
                // if this API authenticated with a session cookie.
                .csrf(csrf -> csrf.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Browsers send a CORS preflight with no credentials at all, so it
                        // must be permitted or every cross-origin write 401s before the
                        // real request is ever sent.
                        .requestMatchers(HttpMethod.OPTIONS, "/**")
                        .permitAll()
                        .requestMatchers("/api/auth/**")
                        .permitAll()
                        // The public surface: feed, permalinks, search, creators,
                        // collections, comments and the like/view counters.
                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/feed",
                                "/api/reels/**",
                                "/api/creators/**",
                                "/api/collections/**",
                                "/api/tags/**")
                        .permitAll()
                        .requestMatchers(
                                HttpMethod.POST, "/api/reels/*/views", "/api/reels/*/like", "/api/reels/*/comments")
                        .permitAll()
                        .requestMatchers(
                                "/media/**",
                                "/swagger-ui/**",
                                "/swagger-ui.html",
                                "/v3/api-docs/**",
                                "/actuator/health")
                        .permitAll()
                        // Creator management is admin-only; everything else under /api/admin
                        // needs any authenticated studio user.
                        .requestMatchers("/api/admin/creators/**")
                        .hasRole("ADMIN")
                        .requestMatchers("/api/admin/**")
                        .hasAnyRole("ADMIN", "CREATOR")
                        .anyRequest()
                        .authenticated())
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsSource() {
        var config = new CorsConfiguration();
        // Explicit origins, not "*". allowCredentials with a wildcard origin is
        // rejected outright by the browser, and the resulting error names neither.
        config.setAllowedOrigins(List.of(allowedOrigins));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        var source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
