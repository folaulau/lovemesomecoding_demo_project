package com.reelcms.api.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI reelcmsOpenApi() {
        final String scheme = "bearer-jwt";
        return new OpenAPI()
                .info(new Info()
                        .title("ReelCMS API")
                        .version("v1")
                        .description("Short-video CMS on MongoDB — a demo for lovemesomecoding.com"))
                // Registering the scheme AND adding the requirement is two steps; doing
                // only the first gives you the Authorize button with nothing behind it.
                .components(new Components()
                        .addSecuritySchemes(
                                scheme,
                                new SecurityScheme()
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList(scheme));
    }
}
