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
import { AuthGuard } from "@nestjs/passport";
import { FastifyReply } from "fastify";
import {
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiTags,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { SignupDto } from "./dto/signup.dto";
import { LoginDto } from "./dto/login.dto";
import { validate } from "class-validator";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 🔹 Sign-up Endpoint
  @Post("signup")
  @ApiOperation({ summary: "Sign up a new user" })
  @ApiBody({ type: SignupDto })
  @ApiResponse({ status: 201, description: "User successfully signed up." })
  @ApiResponse({ status: 400, description: "Validation failed or bad input." })
  async signup(@Body() signupDto: SignupDto, @Response() res: FastifyReply) {
    const errors = await validate(signupDto);
    if (errors.length > 0) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        status: "error",
        message: "Validation failed",
        errors,
      });
    }

    try {
      const resultData = await this.authService.signup(signupDto);
      return res.status(HttpStatus.CREATED).send(resultData);
    } catch (err) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .send({ status: "error", message: err.message });
    }
  }

  // 🔹 Login Endpoint
  @HttpCode(HttpStatus.OK)
  @Post("login")
  @ApiOperation({ summary: "Login a user and return JWT tokens" })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: "Login successful." })
  @ApiResponse({ status: 401, description: "Invalid credentials." })
  async login(@Body() loginDto: LoginDto, @Response() res: FastifyReply) {
    try {
      const { access_token, refresh_token, user } = await this.authService.login(
        loginDto,
        "Browser", // Optional: provide device info
        "Unknown IP" // Optional: provide IP address
      );

      res.setCookie("access_token", access_token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 15 * 60 * 1000,
      });

      return res.send({
        message: "Login successful",
        access_token,
        refresh_token,
        user,
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
  @ApiOperation({ summary: "Refresh access token using a valid refresh token" })
  @ApiBody({ schema: { example: { refresh_token: "your_refresh_token" } } })
  @ApiResponse({ status: 200, description: "Access token refreshed successfully." })
  async refreshToken(@Body() body, @Response() res: FastifyReply) {
    const { refresh_token } = body;

    if (!refresh_token) {
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .send({ message: "Refresh token required" });
    }

    try {
      const newTokens = await this.authService.refreshAccessToken(refresh_token);

      res.setCookie("access_token", newTokens.access_token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 15 * 60 * 1000,
      });

      return res.send({
        message: "Token refreshed successfully",
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        user: newTokens.user,
      });
    } catch (error) {
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .send({ message: error.message || "Invalid or expired refresh token" });
    }
  }

  // 🔹 Get User Info
  @UseGuards(AuthGuard("jwt"))
  @Get("getUser")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the authenticated user or user by ID (admin only)" })
  @ApiResponse({ status: 200, description: "User data returned successfully." })
  @ApiResponse({ status: 401, description: "Unauthorized request." })
  async getUser(@Req() req: any, @Response() res: FastifyReply, @Query("id") id?: string) {
    try {
      const userId = id || req.user.userId;
      const user = await this.authService.getUserById(userId);

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
  @ApiOperation({ summary: "Log out and revoke refresh token" })
  @ApiBody({ schema: { example: { refresh_token: "your_refresh_token" } } })
  @ApiResponse({ status: 200, description: "User logged out successfully." })
  async logout(@Body() body, @Response() res: FastifyReply) {
    const { refresh_token } = body;

    if (!refresh_token) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .send({ message: "Refresh token is required" });
    }

    await this.authService.logout(refresh_token);

    res.clearCookie("access_token", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });

    return res.send({ message: "Logged out successfully" });
  }
}
