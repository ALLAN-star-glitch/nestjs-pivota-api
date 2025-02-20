import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { JwtService } from "@nestjs/jwt";
import * as crypto from "crypto";
import * as dayjs from "dayjs";

import { PrismaService } from "./prisma.service";
import { User } from "@prisma/client";
import { validate } from "class-validator";
import { LoginDto } from "./dto/login.dto";
import { SignupDto } from "./dto/signup.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  // ------------------ VALIDATE USER ------------------
  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { roles: true },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    return user;
  }

  // ------------------ SIGNUP FUNCTION ------------------
  async signup(signupDto: SignupDto) {
    // Validate DTO
    const errors = await validate(signupDto);
    if (errors.length > 0) {
      return { message: "Validation failed", errors, status: 400 };
    }
  
    const { firstName, lastName, email, password, confirmPassword, phone, plan, roles } = signupDto;
  
    if (password !== confirmPassword) {
      throw new BadRequestException("Passwords do not match");
    }
  
    // Check if email or phone number already exists
    const existingUser = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
    });
  
    if (existingUser) {
      throw new BadRequestException("An account with this email or phone number already exists.");
    }
  
    const hashedPassword = await bcrypt.hash(password, 12);
  
    // Determine allowed roles based on plan
    const rolesPerPlan = {
      free: ["user"],
      bronze: ["landlord", "employer", "serviceProvider"],
      silver: ["landlord", "employer", "serviceProvider"],
      gold: ["landlord", "employer", "serviceProvider"],
    };
  
    let roleNames = ["user"];
  
    if (roles) {
      const validRoles = roles.filter((role) => rolesPerPlan[plan]?.includes(role));
  
      if (validRoles.length !== roles.length) {
        throw new BadRequestException("Some roles are invalid for your plan.");
      }
  
      if (validRoles.length > (plan === "bronze" ? 1 : plan === "silver" ? 2 : 3)) {
        throw new BadRequestException(
          `You can select up to ${plan === "bronze" ? 1 : plan === "silver" ? 2 : 3} roles for your plan.`
        );
      }
  
      roleNames = [...roleNames, ...validRoles];
    }
  
    // Fetch role IDs
    const roleRecords = await this.prisma.role.findMany({
      where: { name: { in: roleNames } },
    });
  
    if (roleRecords.length !== roleNames.length) {
      throw new BadRequestException("One or more roles do not exist.");
    }
  
    // Create the user
    const user = await this.prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        password: hashedPassword,
        phone,
        plan,
        isPremium: plan !== "free",
      },
    });
  
    // Assign roles
    await this.prisma.userRole.createMany({
      data: roleRecords.map((role) => ({
        userId: user.id,
        roleId: role.id,
      })),
    });
  
    // Fetch the user again, this time including roles
    const createdUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { roles: { include: { role: true } } },
    });
  
    // Extract role names
    const userRoles = createdUser.roles.map((userRole) => userRole.role.name);
  
    let successMessage = "Your account was created successfully.";
    if (plan === "bronze") successMessage = "Your bronze premium membership has been created successfully.";
    else if (plan === "silver") successMessage = "Your silver premium membership has been created successfully.";
    else if (plan === "gold") successMessage = "Your gold premium membership has been created successfully.";
  
    return {
      user: {
        id: createdUser.id,
        firstName: createdUser.firstName,
        lastName: createdUser.lastName,
        email: createdUser.email,
        phone: createdUser.phone,
        plan: createdUser.plan,
        isPremium: createdUser.isPremium,
        roles: userRoles, // Return roles properly
      },
      message: successMessage,
      status: 201,
    };
  }
  

  // ------------------ LOGIN FUNCTION (Multi-Device) ------------------
  async login(loginDto: LoginDto, deviceInfo?: string, ipAddress?: string) {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } }, // Ensure we fetch the role object
    });

    if (!user) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const userRoles = user.roles.map((userRole) => userRole.role.name);

    // Generate Access Token
    const access_token = this.jwtService.sign(
      {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        plan: user.plan,
        roles: userRoles,
      },
      { expiresIn: "15m" }
    );

    // Generate Refresh Token
    const refresh_token = crypto.randomBytes(64).toString("hex");

    // Store refresh token in DB
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refresh_token,
        expiresAt: dayjs().add(7, "days").toDate(),
        device: deviceInfo || "Unknown Device",
        ipAddress: ipAddress || "Unknown IP",
      },
    });

    return {
      message: "Login successful",
      access_token,
      refresh_token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        plan: user.plan,
        isPremium: user.isPremium,
        roles: userRoles,
      },
    };
  }

   // ------------------ Logout Function ------------------

  async logout(refresh_token: string) {
    try {
      // Find and remove refresh token from DB
      await this.prisma.user.updateMany({
        where: { refreshToken: refresh_token },
        data: { refreshToken: null },
      });

      return { message: "User logged out successfully" };
    } catch (error) {
      throw new UnauthorizedException("Failed to log out");
    }
  }

  // ------------------ REFRESH ACCESS TOKEN FUNCTION ------------------
  async refreshAccessToken(refreshToken: string) {
    // Check if the refresh token exists in the database
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: { include: { roles: { select: { role: { select: { name: true } } } } } } },
    });

    if (!storedToken) {
      throw new UnauthorizedException("Invalid refresh token.");
    }

    // Check if the refresh token has expired
    if (dayjs().isAfter(storedToken.expiresAt)) {
      await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });
      throw new UnauthorizedException("Refresh token expired. Please log in again.");
    }

    const user = storedToken.user;
    const userRoles = user.roles.map((role) => role.role.name);

    // Generate a new access token
    const newAccessToken = this.jwtService.sign(
      {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        plan: user.plan,
        roles: userRoles,
      },
      { expiresIn: "15m" }
    );

    return {
      access_token: newAccessToken,
      refresh_token: refreshToken, // Keep the same refresh token
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        plan: user.plan,
        isPremium: user.isPremium,
        roles: userRoles,
      },
    };
  }

  // ------------------ GET USER BY ID ------------------
  async getUserById(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    });
  }
}
