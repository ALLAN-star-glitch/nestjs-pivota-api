import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { JwtService } from "@nestjs/jwt";
import * as crypto from "crypto";
import dayjs from "dayjs";

import { PrismaService } from "./prisma.service";
import { User } from "@prisma/client";
import { validate } from "class-validator";
import { LoginDto } from "./dto/login.dto";
import { SignupDto } from "./dto/signup.dto";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  /**
   * Validates user credentials and returns full user record with roles and plan.
   */
  async validateUser(email: string, password: string): Promise<
    User & {
      roles: { role: { name: string } }[];
      plan: { name: string } | null;
    }
  > {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } }, plan: true },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException("Sorry, invalid credentials");
    }

    return user;
  }

  /**
   * Handles user signup logic.
   * - Automatically assigns `registered_user` role
   * - Prevents assigning unauthorized roles
   */
  async signup(signupDto: SignupDto) {
    const errors = await validate(signupDto);
    if (errors.length > 0) {
      return { message: "Validation failed", errors, status: 400 };
    }

    const {
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
      phone,
      plan,
      roles,
    } = signupDto;

    if (password !== confirmPassword) {
      throw new BadRequestException("Sorry, passwords do not match");
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
    });

    if (existingUser) {
      throw new BadRequestException("Email or phone already exists.");
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const planRecord = await this.prisma.plan.findUnique({
      where: { name: plan },
    });

    if (!planRecord) {
      throw new BadRequestException("Selected plan does not exist.");
    }

    const isPremium = plan !== "Free Plan";

    // Assign default role only
    const assignedRoles = ["registered_user"];

    // Reject user-supplied roles unless admin-created
    if (roles?.length) {
      throw new BadRequestException(
        "Roles can only be assigned by an admin after signup."
      );
    }

    const roleRecords = await this.prisma.role.findMany({
      where: { name: { in: assignedRoles } },
    });

    if (roleRecords.length !== assignedRoles.length) {
      throw new BadRequestException("Required roles are missing in the system.");
    }

    const user = await this.prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        password: hashedPassword,
        phone,
        planId: planRecord.id,
        isPremium,
      },
    });

    // Link the user to the default `registered_user` role
    await this.prisma.userRole.createMany({
      data: roleRecords.map((role) => ({
        userId: user.id,
        roleId: role.id,
      })),
    });

    const createdUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        roles: { include: { role: true } },
        plan: true,
      },
    });

    const userRoles = createdUser.roles.map((r) => r.role.name);
    const message =
      plan === "Free Plan"
        ? "Your account was created successfully."
        : `Your ${plan} premium membership has been created successfully.`;

    return {
      user: {
        id: createdUser.id,
        firstName: createdUser.firstName,
        lastName: createdUser.lastName,
        email: createdUser.email,
        phone: createdUser.phone,
        plan: createdUser.plan?.name,
        isPremium: createdUser.isPremium,
        roles: userRoles,
      },
      message,
      status: 201,
    };
  }

  /**
   * Logs in a user and issues new access/refresh tokens
   */
  async login(loginDto: LoginDto, deviceInfo?: string, ipAddress?: string) {
    const { email, password } = loginDto;
    const user = await this.validateUser(email, password);

    const userRoles = user.roles.map((r) => r.role.name);
    const access_token = this.generateAccessToken(user);
    const refresh_token = crypto.randomBytes(64).toString("hex");

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
        plan: user.plan?.name || "Free Plan",
        isPremium: user.isPremium,
        roles: userRoles,
      },
    };
  }

  /**
   * Generates JWT access token with role/plan context
   */
  private generateAccessToken(
    user: User & {
      roles: { role: { name: string } }[];
      plan?: { name: string } | null;
    }
  ): string {
    const userRoles = user.roles.map((ur) => ur.role.name);

    return this.jwtService.sign(
      {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        plan: user.plan?.name || "Free Plan",
        roles: userRoles,
      },
      { expiresIn: "15m" }
    );
  }

  /**
   * Logs user out by deleting refresh token
   */
  async logout(refresh_token: string) {
    await this.prisma.refreshToken.deleteMany({
      where: { token: refresh_token },
    });
    return { message: "User logged out successfully" };
  }

  /**
   * Issues new access and refresh tokens
   */
  async refreshAccessToken(refreshToken: string) {
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: {
        user: {
          include: {
            roles: { include: { role: true } },
            plan: true,
          },
        },
      },
    });

    if (!storedToken) {
      throw new UnauthorizedException("Invalid refresh token.");
    }

    if (dayjs().isAfter(storedToken.expiresAt)) {
      await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });
      throw new UnauthorizedException("Refresh token expired.");
    }

    const user = storedToken.user;
    const newAccessToken = this.generateAccessToken(user);
    const newRefreshToken = uuidv4();

    await this.prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: user.id,
        expiresAt: dayjs().add(30, "days").toDate(),
        device: "Refreshed",
        ipAddress: "Unknown",
      },
    });

    await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        plan: user.plan?.name || "Free Plan",
        isPremium: user.isPremium,
        roles: user.roles.map((r) => r.role.name),
      },
    };
  }

  /**
   * Returns user by ID with role and plan details
   */
  async getUserById(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } }, plan: true },
    });
  }
}
