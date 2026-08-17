package com.pizza.api.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class RestMVCConfig {

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {

            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/**")
                        .allowCredentials(true)
                        .allowedHeaders("*")
                        .allowedMethods("*")
                        .allowedOrigins(
                                "http://localhost:3010",
                                "http://127.0.0.1:3010",
                                "http://localhost:5173",
                                "http://127.0.0.1:5173");
            }

            @Override
            public void addResourceHandlers(ResourceHandlerRegistry registry) {
                // TODO Auto-generated method stub
                // WebMvcConfigurer.super.addResourceHandlers(registry);

                registry.addResourceHandler("swagger-ui.html").addResourceLocations("classpath:/META-INF/resources/");

                registry.addResourceHandler("/webjars/**")
                        .addResourceLocations("classpath:/META-INF/resources/webjars/");
            }
        };
    }
}
