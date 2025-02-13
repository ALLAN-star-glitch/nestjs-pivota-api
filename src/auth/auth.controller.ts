import { Controller, Post, Body, HttpStatus, HttpCode, UseGuards, Response } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport'; // Passport guard for JWT
import { FastifyReply } from 'fastify'; // FastifyReply type
import { ApiOperation, ApiResponse, ApiBody, ApiTags, ApiBearerAuth } from '@nestjs/swagger'; // Swagger decorators
import { SignupDto } from './dto/signup.dto';
import { validate } from 'class-validator';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/Login-Response.dto';

@ApiTags('Auth') // Grouping routes under 'Auth' category
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {
    console.log('AuthController initialized');
  }

  // Sign-up endpoint
  @Post('signup')
  @ApiOperation({ summary: 'Sign up a new user' }) // Operation summary for the signup endpoint
  @ApiBody({ type: SignupDto })  // Use the SignupDto for Swagger documentation
  @ApiResponse({ status: 201, description: 'User successfully signed up.' }) // Success response
  @ApiResponse({ status: 400, description: 'Bad request.' }) // Failure response
  async signup(@Body() signupDto: SignupDto) {
    const errors = await validate(signupDto);
    if (errors.length > 0) {
      return { status: 'error', message: errors };  // Return validation errors if any
    }

    // Proceed with the signup logic if validation is successful
    const resultData = await this.authService.signup(signupDto);
    return { status: resultData.status, message: resultData.message, user: resultData.user || null };
  }

  // Login endpoint with JWT and cookies
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Login a user and return JWT tokens' })
  @ApiBody({ type: LoginDto, description: 'User login credentials', required: true })
  @ApiResponse({ status: 200, description: 'Login successful and tokens returned.', type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  async login(
    @Body() loginDto: LoginDto,
    @Response() res: FastifyReply,
  ): Promise<FastifyReply>{
    try {
      const { access_token, refresh_token, user } = await this.authService.login(loginDto);
  
      res.setCookie('access_token', access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 3600000, // 1 hour expiration for access token
      });
  
      res.setCookie('refresh_token', refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days expiration for refresh token
      });
  
      return res.send({
        message: 'Login successful',
        userId: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        plan: user.plan,
        phone: user.phone,
        roles: user.roles,
        
      });
    } catch (error) {
      console.error(error);
      return res.status(HttpStatus.UNAUTHORIZED).send({ message: 'Invalid credentials' });
    }
  }

  // Protected route - only accessible if the user is authenticated
  @UseGuards(AuthGuard('jwt'))  // Protecting the route with the JWT Auth Guard
  @Post('protected')
  @ApiBearerAuth() // Indicates that this endpoint requires Bearer Auth (JWT)
  @ApiOperation({ summary: 'Access a protected route' }) // Operation summary for the protected endpoint
  @ApiResponse({ status: 200, description: 'Access granted to protected route.' }) // Success response
  @ApiResponse({ status: 401, description: 'Unauthorized access.' }) // Unauthorized response
  async protected(@Response() res: FastifyReply) {
    return res.status(HttpStatus.OK).send({
      message: 'This is a protected route.',
    });
  }
}
