package com.pizza.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/** Proves the authorization rules actually hold at the HTTP layer. */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@DisplayName("API security")
class ApiSecurityIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    // Constructed rather than @Autowired: Spring Boot 4 does not expose a plain ObjectMapper
    // bean in this context, and the test only needs to pluck one field out of a response.
    private final ObjectMapper objectMapper = new ObjectMapper();

    private String tokenFor(String email, String password) throws Exception {
        String body = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"%s"}"""
                                .formatted(email, password)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(body).get("token").asText();
    }

    @Test
    @DisplayName("the menu is public")
    void menuIsPublic() throws Exception {
        mockMvc.perform(get("/api/products")).andExpect(status().isOk());
        mockMvc.perform(get("/api/toppings")).andExpect(status().isOk());
        mockMvc.perform(get("/api/crusts")).andExpect(status().isOk());
    }

    @Test
    @DisplayName("admin endpoints are closed without a token")
    void adminRequiresToken() throws Exception {
        mockMvc.perform(get("/api/admin/products")).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/admin/orders")).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/admin/reports/dashboard")).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("a CUSTOMER token does not open admin endpoints")
    void customerCannotReachAdmin() throws Exception {
        String token = tokenFor("customer@pizza.test", "pizza123");

        mockMvc.perform(get("/api/admin/products").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/admin/reports/dashboard").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("an ADMIN token does")
    void adminCanReachAdmin() throws Exception {
        String token = tokenFor("admin@pizza.test", "admin123");

        mockMvc.perform(get("/api/admin/products").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/admin/reports/dashboard").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary").exists())
                .andExpect(jsonPath("$.revenueByDay").isArray())
                .andExpect(jsonPath("$.topProducts").isArray())
                .andExpect(jsonPath("$.statusBreakdown").isArray());
    }

    @Test
    @DisplayName("a forged or garbage token is simply not authenticated")
    void garbageTokenIsRejected() throws Exception {
        mockMvc.perform(get("/api/admin/products").header("Authorization", "Bearer not.a.real.token"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("wrong password gives 401 and never says which part was wrong")
    void wrongPasswordIsVague() throws Exception {
        String body = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                """
                                {"email":"admin@pizza.test","password":"wrong"}"""))
                .andExpect(status().isUnauthorized())
                .andReturn()
                .getResponse()
                .getContentAsString();

        // Must not reveal whether the account exists.
        assertThat(body).contains("Invalid email or password");
        assertThat(body).doesNotContain("no such user").doesNotContain("not found");
    }

    @Test
    @DisplayName("an unknown email fails identically to a wrong password")
    void unknownEmailLooksTheSame() throws Exception {
        mockMvc.perform(
                        post("/api/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        """
                                {"email":"nobody@pizza.test","password":"whatever1"}"""))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("/api/auth/me returns the caller, and never a password hash")
    void meReturnsSafeFields() throws Exception {
        String token = tokenFor("customer@pizza.test", "pizza123");

        String body = mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("customer@pizza.test"))
                .andExpect(jsonPath("$.role").value("CUSTOMER"))
                .andReturn()
                .getResponse()
                .getContentAsString();

        assertThat(body).doesNotContain("passwordHash").doesNotContain("$2y$").doesNotContain("$2a$");
    }

    @Test
    @DisplayName("registration always creates a CUSTOMER, even if the body asks for ADMIN")
    void registrationCannotSelfPromote() throws Exception {
        String email = "escalate" + System.nanoTime() + "@example.com";

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                """
                                {"email":"%s","password":"password123","fullName":"Sneaky","role":"ADMIN"}"""
                                        .formatted(email)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.user.role").value("CUSTOMER"));
    }
}
