package com.pizza.api.entity.user;

import com.pizza.api.dto.AuthenticationResponseDTO;
import com.pizza.api.dto.LoginDTO;
import com.pizza.api.dto.RegisterDTO;
import com.pizza.api.dto.UserDTO;

public interface UserService {

    AuthenticationResponseDTO register(RegisterDTO dto);

    AuthenticationResponseDTO login(LoginDTO dto);

    UserDTO getUserByEmail(String email);
}
