package com.pizza.api.config;

import com.pizza.api.security.JwtAuthenticationFilter;
import java.util.Arrays;
import java.util.List;
import lombok.RequiredArgsConstructor;
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
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Security rules.
 *
 * <p>This is Spring Security 7's lambda DSL — version 7 removed the older chained-setter style
 * entirely, so examples written against Spring Security 5 will not compile here.
 *
 * <p>Rules are evaluated IN ORDER, first match wins. That is why the specific patterns
 * ({@code /api/orders/mine}) come before the general ones ({@code /api/orders/**}).
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    @Value("${pizza.cors.allowed-origins}")
    private String allowedOrigins;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.cors(Customizer.withDefaults())
                // Safe to disable ONLY because this API is stateless and token-based: there is no
                // session cookie for a cross-site request to ride on. Never do this for a
                // cookie-authenticated app.
                .csrf(csrf -> csrf.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // ---- documentation -------------------------------------------------
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html")
                        .permitAll()

                        // ---- auth ----------------------------------------------------------
                        .requestMatchers("/api/auth/register", "/api/auth/login")
                        .permitAll()
                        .requestMatchers("/api/auth/me")
                        .authenticated()

                        // ---- Stripe callbacks ----------------------------------------------
                        // Stripe cannot present a JWT. This endpoint is protected instead by
                        // verifying the Stripe-Signature header — see StripeWebhookController.
                        .requestMatchers("/api/webhooks/**")
                        .permitAll()

                        // ---- public menu ---------------------------------------------------
                        .requestMatchers(HttpMethod.GET, "/api/products/**", "/api/toppings/**", "/api/crusts/**")
                        .permitAll()

                        // ---- cart ----------------------------------------------------------
                        // Public, like guest checkout — you do not need an account to fill a
                        // basket. The cart's unguessable UUID is what protects it.
                        .requestMatchers("/api/carts", "/api/carts/**")
                        .permitAll()

                        // ---- orders --------------------------------------------------------
                        // Specific first: order history needs a real account.
                        .requestMatchers(HttpMethod.GET, "/api/orders/mine")
                        .authenticated()
                        // Placing an order must NOT require a login — this is guest checkout.
                        .requestMatchers(HttpMethod.POST, "/api/orders")
                        .permitAll()
                        // Reading one order is public so a guest can see their confirmation page
                        // without an account.
                        // LIMITATION: ids are sequential, so anyone could walk them. A production
                        // system would use an unguessable reference (UUID) or a signed link.
                        // Left simple here deliberately, and called out rather than hidden.
                        .requestMatchers(HttpMethod.GET, "/api/orders/*", "/api/orders/*/payment-status")
                        .permitAll()

                        // ---- admin ---------------------------------------------------------
                        .requestMatchers("/api/admin/**")
                        .hasRole("ADMIN")
                        .requestMatchers("/actuator/health")
                        .permitAll()

                        // Default deny. Anything not listed above needs authentication, so a new
                        // endpoint is closed until someone deliberately opens it.
                        .anyRequest()
                        .authenticated())
                // Runs before the username/password filter so a valid token authenticates the
                // request before anything tries to challenge it.
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

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
