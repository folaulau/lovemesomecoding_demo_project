import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common'

import { CurrentUser } from '../common/decorators/current-user.decorator.js'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js'
import type { AuthenticatedUser } from './jwt-payload.js'
import { AuthService } from './auth.service.js'
import { LoginDto, RegisterDto } from './dto/auth.dto.js'

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto)
  }

  /**
   * ⚠️ `@HttpCode(200)`. Nest answers a POST with 201 by default, which is right for "a resource
   * was created" and wrong here — logging in creates nothing. A client that branches on the status
   * code would be told a user was just created on every sign-in.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto)
  }

  /**
   * Who the current token says you are. Useful for a client checking whether a stored token is
   * still valid, and it costs no database query — the answer is entirely inside the JWT.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return user
  }
}
