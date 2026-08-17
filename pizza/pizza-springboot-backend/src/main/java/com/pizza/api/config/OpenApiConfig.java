package com.pizza.api.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Swagger UI metadata, served at /swagger-ui.html.
 *
 * <p>springdoc is pinned to 2.8.6 in the pom because Spring Boot 4.1 does not manage an OpenAPI
 * version at all. That combination is verified working against Spring Framework 7.
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI pizzaOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Pizza API")
                        .version("v1")
                        .description("Ordering API for the pizza demo app. "
                                + "Menu browsing and guest checkout are public; everything under "
                                + "/api/admin requires an ADMIN token. "
                                + "Demo accounts: admin@pizza.test / admin123 and "
                                + "customer@pizza.test / pizza123."))
                .components(new Components()
                        .addSecuritySchemes(
                                "bearerAuth",
                                new SecurityScheme()
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")));
    }
}
