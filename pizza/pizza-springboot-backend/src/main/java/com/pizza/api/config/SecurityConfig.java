package com.pizza.api.config;

import java.util.Arrays;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Baseline security.
 *
 * <p>This is Spring Security 7's lambda DSL — version 7 removed the older chained-setter style
 * entirely, so examples written against Spring Security 5 will not compile here.
 *
 * <p><b>Phase 1 scope.</b> This opens up the routes the app needs to be usable and testable. The
 * JWT filter, the {@code /api/admin/**} role check and real authentication arrive in Phase 3; the
 * matchers below are already laid out to receive them.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Value("${pizza.cors.allowed-origins}")
    private String allowedOrigins;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.cors(Customizer.withDefaults())
                // Safe to disable ONLY because this API is stateless and token-based: with no
                // session cookie there is nothing for a cross-site request to ride on.
                .csrf(csrf -> csrf.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // API documentation
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html")
                        .permitAll()
                        // The menu is public — you can browse without an account
                        .requestMatchers(HttpMethod.GET, "/api/products/**", "/api/toppings/**", "/api/crusts/**")
                        .permitAll()
                        // Guest checkout: placing an order must not require a login
                        .requestMatchers(HttpMethod.POST, "/api/orders/**")
                        .permitAll()
                        .requestMatchers("/api/auth/**", "/api/webhooks/**")
                        .permitAll()
                        .requestMatchers("/actuator/health")
                        .permitAll()
                        // TODO Phase 3: .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .anyRequest()
                        .permitAll());
        return http.build();
    }

    /**
     * BCrypt deliberately makes hashing slow, which is the point: it makes brute-forcing a stolen
     * password table expensive. Never store a password with a fast hash such as MD5 or SHA-256.
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /** Lets the React (5173) and Angular (4200) dev servers call this API from the browser. */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(Arrays.asList(allowedOrigins.split(",")));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
