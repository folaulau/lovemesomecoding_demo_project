package com.pizza.api.entity.user;

import static org.springframework.http.HttpStatus.CREATED;
import static org.springframework.http.HttpStatus.OK;

import com.pizza.api.dto.AuthenticationResponseDTO;
import com.pizza.api.dto.LoginDTO;
import com.pizza.api.dto.RegisterDTO;
import com.pizza.api.dto.UserDTO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.security.Principal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Auth", description = "Registration and sign-in")
@RequestMapping("/api/auth")
@RestController
@Slf4j
public class AuthRestController {

    @Autowired
    private UserService userService;

    @Operation(summary = "Create a customer account and return a token")
    @PostMapping("/register")
    public ResponseEntity<AuthenticationResponseDTO> register(@Valid @RequestBody RegisterDTO dto) {
        log.info("POST /api/auth/register");
        return new ResponseEntity<>(userService.register(dto), CREATED);
    }

    @Operation(summary = "Exchange email and password for a JWT")
    @PostMapping("/login")
    public ResponseEntity<AuthenticationResponseDTO> login(@Valid @RequestBody LoginDTO dto) {
        log.info("POST /api/auth/login");
        return new ResponseEntity<>(userService.login(dto), OK);
    }

    @Operation(summary = "Who am I? Confirms the token is valid")
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/me")
    public ResponseEntity<UserDTO> me(Principal principal) {
        // The JWT filter put the email in the SecurityContext; Spring hands it over as Principal.
        return new ResponseEntity<>(userService.getUserByEmail(principal.getName()), OK);
    }
}
