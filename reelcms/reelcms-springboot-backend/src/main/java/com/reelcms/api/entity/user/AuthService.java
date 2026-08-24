package com.reelcms.api.entity.user;

import com.reelcms.api.dto.Dtos.LoginRequest;
import com.reelcms.api.dto.Dtos.LoginResponse;
import com.reelcms.api.dto.EntityDtoMapper;
import com.reelcms.api.exception.ApiException;
import com.reelcms.api.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final EntityDtoMapper mapper;

    public LoginResponse login(LoginRequest request) {
        User user = userRepository
                .findByEmail(request.email().trim().toLowerCase())
                // One message for both "no such user" and "wrong password". Distinct
                // messages turn the login form into an account-enumeration oracle.
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }

        return new LoginResponse(jwtService.issue(user), mapper.toDto(user));
    }
}
