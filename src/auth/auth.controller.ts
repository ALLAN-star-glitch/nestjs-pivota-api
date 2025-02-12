import { Controller, Post, Body, HttpStatus, HttpCode, UseGuards, Response } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport'; // Passport guard for JWT
import { FastifyReply } from 'fastify'; // FastifyReply type

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {
    console.log('AuthController initialized');
  }

  // Sign-up endpoint
  @Post('signup')
  async signup(@Body() signupDto: any) {
    const result = await this.authService.signup(signupDto);
    return { status: result.status, message: result.message, user: result.user || null };
  }

  // Login endpoint with JWT and cookies
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() body: { email: string; password: string },
    @Response() res: FastifyReply, // FastifyReply used for response handling
  ) {
    try {
      // Call the service method to login and get tokens
      const { access_token, refresh_token } = await this.authService.login(body.email, body.password);

      // Set access_token and refresh_token in HTTP-only cookies
      res.setCookie('access_token', access_token, {
        httpOnly: true, // Cannot be accessed by JavaScript
        secure: process.env.NODE_ENV === 'production', // Secure only in production (use https)
        sameSite: 'strict', // Prevent cross-site request forgery
        maxAge: 3600000, // 1 hour expiration for access token
      });

      res.setCookie('refresh_token', refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days expiration for refresh token
      });

      // Return success response
      return res.send({ message: 'Login successful' });
    } catch (error) {
      console.error(error);
      return res.status(HttpStatus.UNAUTHORIZED).send({ message: 'Invalid credentials' });
    }
  }

  // Protected route - only accessible if the user is authenticated
  @UseGuards(AuthGuard('jwt'))  // Protecting the route with the JWT Auth Guard
  @Post('protected')
  async protected(@Response() res: FastifyReply) {
    // Handle the protected route logic here
    return res.status(HttpStatus.OK).send({
      message: 'This is a protected route.',
    });
  }
}
