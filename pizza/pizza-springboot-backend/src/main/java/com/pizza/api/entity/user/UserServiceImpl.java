package com.pizza.api.entity.user;

import com.pizza.api.dto.AuthenticationResponseDTO;
import com.pizza.api.dto.EntityDTOMapper;
import com.pizza.api.dto.LoginDTO;
import com.pizza.api.dto.RegisterDTO;
import com.pizza.api.dto.UserDTO;
import com.pizza.api.exception.ApiException;
import com.pizza.api.security.JwtService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Slf4j
public class UserServiceImpl implements UserService {

    @Autowired
    private UserDAO userDAO;

    @Autowired
    private EntityDTOMapper mapper;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    @Override
    @Transactional
    public AuthenticationResponseDTO register(RegisterDTO dto) {
        log.info("Registering {}", dto.email());

        if (userDAO.existsByEmail(dto.email())) {
            throw ApiException.badRequest("That email is already registered");
        }

        User user = User.builder()
                .email(dto.email().trim().toLowerCase())
                // Hash immediately. The plaintext password must never be stored, logged, or
                // returned — from here on only the hash exists.
                .passwordHash(passwordEncoder.encode(dto.password()))
                .fullName(dto.fullName())
                // Registration ALWAYS creates a CUSTOMER. If the role came from the request body,
                // anyone could sign up as an admin by adding one field to the JSON.
                .role(UserRole.CUSTOMER)
                .build();

        return buildAuthResponse(userDAO.save(user));
    }

    @Override
    @Transactional(readOnly = true)
    public AuthenticationResponseDTO login(LoginDTO dto) {
        User user = userDAO.findByEmail(dto.email())
                // Same exception whether the user is unknown or the password is wrong, so the
                // response cannot be used to discover which emails have accounts.
                .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));

        if (!passwordEncoder.matches(dto.password(), user.getPasswordHash())) {
            throw new BadCredentialsException("Invalid email or password");
        }

        log.info("{} signed in", user.getEmail());
        return buildAuthResponse(user);
    }

    @Override
    @Transactional(readOnly = true)
    public UserDTO getUserByEmail(String email) {
        return userDAO.findByEmail(email)
                .map(mapper::mapUserToUserDTO)
                .orElseThrow(() -> ApiException.notFound("No account for " + email));
    }

    private AuthenticationResponseDTO buildAuthResponse(User user) {
        return new AuthenticationResponseDTO(
                jwtService.generateToken(user), jwtService.getExpirationMinutes(), mapper.mapUserToUserDTO(user));
    }
}
