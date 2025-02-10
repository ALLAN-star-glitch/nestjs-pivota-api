// src/auth/auth.controller.ts
import { Controller, Post, Body, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signup(@Body() signupDto: any) {
    const result = await this.authService.signup(signupDto);
    return { status: result.status, message: result.message, user: result.user || null };
  }
}
