import {
  Controller,
  Post,
  Body,
  HttpStatus,
  HttpCode,
  UseGuards,
  Response,
  Req,
  Get,
  Query,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthGuard } from "@nestjs/passport"; // JWT Auth Guard
import { FastifyReply } from "fastify"; // FastifyReply type
import {
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiTags,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { SignupDto } from "./dto/signup.dto";
import { validate } from "class-validator";
import { LoginDto } from "./dto/login.dto";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 🔹 Sign-up Endpoint
  @Post("signup")
  @ApiOperation({ summary: "Sign up a new user" })
  @ApiBody({ type: SignupDto })
  @ApiResponse({ status: 201, description: "User successfully signed up." })
  @ApiResponse({ status: 400, description: "Bad request." })
  async signup(@Body() signupDto: SignupDto) {
    const errors = await validate(signupDto);
    if (errors.length > 0) {
      return { status: "error", message: errors };
    }
    const resultData = await this.authService.signup(signupDto);
    return {
      status: resultData.status,
      message: resultData.message,
      user: resultData.user || null,
    };
  }

// 🔹 Login Endpoint
@HttpCode(HttpStatus.OK)
@Post("login")
@ApiOperation({ summary: "Login a user and return JWT tokens" })
@ApiBody({ type: LoginDto, description: "User login credentials", required: true })
@ApiResponse({ status: 200, description: "Login successful." })
@ApiResponse({ status: 401, description: "Invalid credentials." })
async login(@Body() loginDto: LoginDto, @Response() res: FastifyReply) {
  try {
    const { access_token, refresh_token, user } = await this.authService.login(loginDto);

    // Store Access Token in HTTP-only Cookie
    res.setCookie("access_token", access_token, {
      httpOnly: true,
      secure: true,  // Ensure secure cookie transmission over HTTPS
      sameSite: "lax",  // Adjust based on your needs (strict or lax)
      maxAge: 15 * 60 * 1000, // 15 minutes expiry for access token
    });

    // Store Refresh Token in HTTP-only Cookie
    res.setCookie("refresh_token", refresh_token, {
      httpOnly: true,
      secure: true,  // Ensure secure cookie transmission over HTTPS
      sameSite: "lax",  // Adjust based on your needs (strict or lax)
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days expiry for refresh token
    });

    return res.send({
      message: "Login successful",
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        plan: user.plan,
        phone: user.phone,
        roles: user.roles,
      },
    });
  } catch (error) {
    return res
      .status(HttpStatus.UNAUTHORIZED)
      .send({ message: "Invalid credentials" });
  }
}

  // 🔹 Refresh Access Token
  @HttpCode(HttpStatus.OK)
  @Post("refresh-token")
  @ApiOperation({ summary: "Refresh the access token using a valid refresh token" })
  @ApiBody({ description: "Send refresh token in request body", required: true })
  @ApiResponse({ status: 200, description: "New access token generated." })
  @ApiResponse({ status: 401, description: "Invalid or expired refresh token." })
  async refreshToken(@Body() body, @Response() res: FastifyReply) {
    const { refresh_token } = body;

    if (!refresh_token) {
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .send({ message: "Refresh token required" });
    }

    const newTokens = await this.authService.refreshAccessToken(refresh_token);

    if (!newTokens) {
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .send({ message: "Invalid or expired refresh token" });
    }

    // Store new access token in HTTP-only cookie
    res.setCookie("access_token", newTokens.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 15 * 60 * 1000, // 15 minutes expiry
    });

    return res.send({
      refresh_token: newTokens.refresh_token, // New refresh token for client
    });
  }

// 🔹 Get User by ID or Authenticated User
@UseGuards(AuthGuard("jwt"))
@Get("getUser")
@ApiBearerAuth()
@ApiOperation({ summary: "Get the current authenticated user or a user by ID" })
@ApiResponse({ status: 200, description: "Successfully retrieved user data." })
@ApiResponse({ status: 401, description: "Unauthorized." })
async getUser(@Req() req: any,   @Response() res: FastifyReply, @Query("id") id?: string) {
  try {
    const accessToken = req.cookies["access_token"];
    if (!accessToken) {
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .send({ message: "Access token not provided or expired" });
    }

    let user;

    if (id) {
      // If an ID is provided, fetch the user by that ID
      user = await this.authService.getUserById(id);
    } else {
      // Otherwise, fetch the authenticated user using the userId from the token
      user = await this.authService.getUserById(req.user.userId);
    }

    if (!user) {
      return res.status(HttpStatus.NOT_FOUND).send({ message: "User not found." });
    }

    return res.status(HttpStatus.OK).send({ user });
  } catch (error) {
    return res
      .status(HttpStatus.UNAUTHORIZED)
      .send({ message: "Invalid or expired token" });
  }
}


  // 🔹 Logout Endpoint
  @HttpCode(HttpStatus.OK)
  @Post("logout")
  @ApiOperation({ summary: "Logout user by revoking refresh token" })
  @ApiBody({ description: "Send refresh token in request body", required: true })
  @ApiResponse({ status: 200, description: "Successfully logged out." })
  async logout(@Body() body, @Response() res: FastifyReply) {
    const { refresh_token } = body;

    if (!refresh_token) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .send({ message: "Refresh token required" });
    }

    await this.authService.logout(refresh_token);

    // Clear Access Token Cookie
    res.clearCookie("access_token", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });

    return res.send({ message: "Logged out successfully" });
  }
}
