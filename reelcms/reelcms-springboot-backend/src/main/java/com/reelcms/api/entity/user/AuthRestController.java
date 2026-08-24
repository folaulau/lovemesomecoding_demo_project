package com.reelcms.api.entity.user;

import com.reelcms.api.dto.Dtos.LoginRequest;
import com.reelcms.api.dto.Dtos.LoginResponse;
import com.reelcms.api.dto.Dtos.UserDto;
import com.reelcms.api.security.AuthPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Auth")
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthRestController {

    private final AuthService authService;

    @Operation(summary = "Exchange email and password for a JWT")
    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @Operation(summary = "Who the current token belongs to")
    @GetMapping("/me")
    public UserDto me(@AuthenticationPrincipal AuthPrincipal principal) {
        return new UserDto(
                principal.userId(), principal.email(), principal.email(), principal.roles(), principal.creatorId());
    }
}
